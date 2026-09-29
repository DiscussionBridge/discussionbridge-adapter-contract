import { createHash, createPublicKey, verify } from "node:crypto";
import { parseFragment } from "parse5";

export class ProtocolError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = "ProtocolError";
    this.code = code;
  }
}

const bytes = (value) => Buffer.byteLength(value, "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const timestampPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?Z$/;
const base64urlPattern = /^[A-Za-z0-9_-]+$/;

function fail(code, message) {
  throw new ProtocolError(code, message);
}

export function parseProtocolJson(text) {
  if (typeof text !== "string") fail("validation_failed", "protocol JSON must be text");
  validateJsonText(text);
  try {
    return JSON.parse(text, (key, value, context) => {
      if (key === "existing_topic_id" && typeof value === "number") {
        const exact = exactJsonInteger(context.source);
        if (exact === null) fail("validation_failed", "existing_topic_id must be an exact JSON integer");
        return exact;
      }
      return value;
    });
  } catch (error) {
    if (error instanceof ProtocolError) throw error;
    fail("invalid_json", "protocol JSON is invalid");
  }
}

function exactJsonInteger(source) {
  const match = /^(-?)(0|[1-9]\d*)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(source);
  if (!match) return null;
  const fraction = match[3] ?? "";
  const exponent = Number.parseInt(match[4] ?? "0", 10);
  if (!Number.isSafeInteger(exponent)) return null;
  let digits = `${match[2]}${fraction}`;
  if (/^0+$/.test(digits)) return 0n;
  const scale = exponent - fraction.length;
  if (scale < 0) {
    const removed = -scale;
    if (removed > digits.length) return null;
    if (!/^0*$/.test(digits.slice(digits.length - removed))) return null;
    digits = digits.slice(0, digits.length - removed) || "0";
  } else if (!/^0+$/.test(digits) && digits.replace(/^0+/, "").length + scale > 19) {
    return match[1] ? -9223372036854775808n : 9223372036854775808n;
  } else {
    digits += "0".repeat(scale);
  }
  const coefficient = BigInt(digits);
  return match[1] ? -coefficient : coefficient;
}

function unicodeScalarString(value, code, name) {
  if (typeof value !== "string") fail(code, `${name} must be a string`);
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    let codePoint = unit;
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) fail(code, `${name} contains an unpaired surrogate`);
      codePoint = value.codePointAt(index);
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      fail(code, `${name} contains an unpaired surrogate`);
    }
    if ((codePoint >= 0xfdd0 && codePoint <= 0xfdef) || (codePoint & 0xfffe) === 0xfffe) fail(code, `${name} contains a Unicode noncharacter`);
  }
}

function readJsonString(text, start) {
  let index = start + 1;
  while (index < text.length) {
    const code = text.charCodeAt(index);
    if (code === 0x22) {
      const raw = text.slice(start, index + 1);
      let value;
      try {
        value = JSON.parse(raw);
      } catch {
        fail("invalid_json", "invalid JSON string");
      }
      unicodeScalarString(value, "invalid_json", "JSON string");
      return { value, next: index + 1 };
    }
    if (code < 0x20) fail("invalid_json", "unescaped control character in JSON string");
    if (code === 0x5c) {
      index += 1;
      if (index >= text.length || !/["\\/bfnrtu]/.test(text[index])) fail("invalid_json", "invalid JSON escape");
      if (text[index] === "u") {
        if (!/^[0-9a-fA-F]{4}$/.test(text.slice(index + 1, index + 5))) fail("invalid_json", "invalid JSON Unicode escape");
        index += 4;
      }
    }
    index += 1;
  }
  fail("invalid_json", "unterminated JSON string");
}

function rawUtf8Character(text, index) {
  const first = text.charCodeAt(index);
  if (first <= 0x7f) return { next: index + 1, bytes: 1 };
  if (first <= 0x7ff) return { next: index + 1, bytes: 2 };
  if (first >= 0xd800 && first <= 0xdbff) {
    const second = text.charCodeAt(index + 1);
    if (second >= 0xdc00 && second <= 0xdfff) return { next: index + 2, bytes: 4 };
  }
  return { next: index + 1, bytes: 3 };
}

function rawUtf8Budget(text, maximum, name) {
  let used = 0;
  return {
    consume(index) {
      const character = rawUtf8Character(text, index);
      used += character.bytes;
      if (used > maximum) fail("validation_failed", `${name} exceeds maximum_json_bytes`);
      return character.next;
    },
  };
}

function consumeRawCharacter(text, index, budget = null) {
  return budget === null ? rawUtf8Character(text, index).next : budget.consume(index);
}

function skipRawJsonString(text, start, budget = null) {
  let index = consumeRawCharacter(text, start, budget);
  while (index < text.length) {
    const code = text.charCodeAt(index);
    const next = consumeRawCharacter(text, index, budget);
    if (code === 0x22) return next;
    if (code === 0x5c) {
      index = next;
      if (index >= text.length) break;
      index = consumeRawCharacter(text, index, budget);
      continue;
    }
    index = next;
  }
  fail("invalid_json", "unterminated JSON string");
}

function validateJsonText(text) {
  const stack = [{ type: "root", state: "value" }];
  let index = 0;
  const skipWhitespace = () => {
    while (index < text.length && /[\t\n\r ]/.test(text[index])) index += 1;
  };
  const valueConsumed = (frame) => {
    frame.state = frame.type === "root" ? "end" : "commaOrEnd";
  };
  const consumeValue = (frame) => {
    const character = text[index];
    valueConsumed(frame);
    if (character === "{") {
      index += 1;
      stack.push({ type: "object", state: "keyOrEnd", keys: new Set() });
      return;
    }
    if (character === "[") {
      index += 1;
      stack.push({ type: "array", state: "valueOrEnd" });
      return;
    }
    if (character === '"') {
      index = readJsonString(text, index).next;
      return;
    }
    const literal = /^(?:true|false|null)/.exec(text.slice(index));
    if (literal) {
      index += literal[0].length;
      return;
    }
    const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(index));
    if (number) {
      index += number[0].length;
      return;
    }
    fail("invalid_json", "invalid JSON value");
  };
  while (true) {
    skipWhitespace();
    const frame = stack.at(-1);
    if (frame.type === "root") {
      if (frame.state === "value") consumeValue(frame);
      else if (stack.length === 1) {
        if (index !== text.length) fail("invalid_json", "trailing JSON data");
        return;
      }
      continue;
    }
    if (frame.type === "object") {
      if (frame.state === "keyOrEnd") {
        if (text[index] === "}") {
          index += 1;
          stack.pop();
          continue;
        }
        if (text[index] !== '"') fail("invalid_json", "object key must be a JSON string");
        const token = readJsonString(text, index);
        if (frame.keys.has(token.value)) fail("invalid_json", `duplicate JSON member: ${token.value}`);
        frame.keys.add(token.value);
        index = token.next;
        frame.state = "colon";
      } else if (frame.state === "colon") {
        if (text[index] !== ":") fail("invalid_json", "missing object member colon");
        index += 1;
        frame.state = "value";
      } else if (frame.state === "value") {
        consumeValue(frame);
      } else if (text[index] === ",") {
        index += 1;
        frame.state = "keyOrEnd";
      } else if (text[index] === "}") {
        index += 1;
        stack.pop();
      } else {
        fail("invalid_json", "object member separator is invalid");
      }
      continue;
    }
    if (frame.state === "valueOrEnd") {
      if (text[index] === "]") {
        index += 1;
        stack.pop();
      } else {
        consumeValue(frame);
      }
    } else if (text[index] === ",") {
      index += 1;
      frame.state = "valueOrEnd";
    } else if (text[index] === "]") {
      index += 1;
      stack.pop();
    } else {
      fail("invalid_json", "array item separator is invalid");
    }
  }
}

function skipJsonWhitespace(text, index, budget = null) {
  while (index < text.length && /[\t\n\r ]/.test(text[index])) index = consumeRawCharacter(text, index, budget);
  return index;
}

function skipRawJsonValue(text, start, budget = null) {
  let index = skipJsonWhitespace(text, start, budget);
  if (text[index] === '"') return skipRawJsonString(text, index, budget);
  if (text[index] !== "{" && text[index] !== "[") {
    while (index < text.length && !/[\t\n\r ,}\]]/.test(text[index])) index = consumeRawCharacter(text, index, budget);
    return index;
  }
  const closers = [text[index] === "{" ? "}" : "]"];
  index = consumeRawCharacter(text, index, budget);
  while (closers.length > 0) {
    if (index >= text.length) fail("invalid_json", "unterminated JSON value");
    if (text[index] === '"') {
      index = skipRawJsonString(text, index, budget);
      continue;
    }
    const character = text[index];
    const next = consumeRawCharacter(text, index, budget);
    if (character === "{") closers.push("}");
    else if (character === "[") closers.push("]");
    else if (character === closers.at(-1)) closers.pop();
    index = next;
  }
  return index;
}

function topLevelArrayElementTexts(text, propertyName, maximumElementBytes = null, maximumElements = null) {
  let index = skipJsonWhitespace(text, 0);
  if (text[index] !== "{") fail("validation_failed", "JSON envelope must be an object");
  index += 1;
  while (true) {
    index = skipJsonWhitespace(text, index);
    if (text[index] === "}") return null;
    const key = readJsonString(text, index);
    index = skipJsonWhitespace(text, key.next);
    if (text[index] !== ":") fail("invalid_json", "JSON object member lacks a colon");
    index = skipJsonWhitespace(text, index + 1);
    if (key.value === propertyName) {
      if (text[index] !== "[") fail("validation_failed", `${propertyName} must be an array`);
      index += 1;
      const elements = [];
      while (true) {
        const segmentStart = index;
        const budget = maximumElementBytes === null ? null : rawUtf8Budget(text, maximumElementBytes, `${propertyName} item`);
        index = skipJsonWhitespace(text, index, budget);
        if (text[index] === "]") return elements;
        if (maximumElements !== null && elements.length >= maximumElements) fail("validation_failed", `${propertyName} exceeds maximum items`);
        index = skipRawJsonValue(text, index, budget);
        index = skipJsonWhitespace(text, index, budget);
        const elementText = text.slice(segmentStart, index);
        elements.push(elementText);
        if (text[index] === "]") return elements;
        if (text[index] !== ",") fail("invalid_json", `${propertyName} has an invalid separator`);
        index += 1;
      }
    }
    index = skipRawJsonValue(text, index);
    index = skipJsonWhitespace(text, index);
    if (text[index] === "}") return null;
    if (text[index] !== ",") fail("invalid_json", "JSON object has an invalid separator");
    index += 1;
  }
}

const stringifyProtocolJson = (value) => JSON.stringify(value, (_key, item) => (
  typeof item === "bigint" ? JSON.rawJSON(item.toString()) : item
));

function object(value, name = "value") {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("validation_failed", `${name} must be an object`);
}

function exactObject(value, required, optional = [], name = "value") {
  object(value, name);
  for (const field of required) if (!Object.hasOwn(value, field)) fail("validation_failed", `${name}.${field} is required`);
  const allowed = new Set([...required, ...optional]);
  for (const field of Object.keys(value)) if (!allowed.has(field)) fail("unknown_field", `${name}.${field} is unknown`);
}

function nonblank(value, maximum, name) {
  if (typeof value !== "string" || value.trim() === "" || bytes(value) > maximum) fail("validation_failed", `${name} is invalid`);
}

function timestamp(value, name) {
  if (typeof value !== "string") fail("validation_failed", `${name} is required`);
  const match = timestampPattern.exec(value);
  if (!match) fail("malformed_value", `${name} is not RFC 3339 UTC`);
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1] || hour > 23 || minute > 59 || second > 59) fail("malformed_value", `${name} is not a real RFC 3339 UTC instant`);
}

function timestampParts(value, name) {
  timestamp(value, name);
  const match = timestampPattern.exec(value);
  const instant = new Date(0);
  instant.setUTCFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  instant.setUTCHours(Number(match[4]), Number(match[5]), Number(match[6]), 0);
  const second = BigInt(Math.trunc(instant.getTime() / 1000));
  return { second, fraction: match[7] ?? "" };
}

function compareTimestamps(left, right, leftName = "left timestamp", rightName = "right timestamp") {
  const a = timestampParts(left, leftName);
  const b = timestampParts(right, rightName);
  if (a.second !== b.second) return a.second < b.second ? -1 : 1;
  const width = Math.max(a.fraction.length, b.fraction.length);
  const af = a.fraction.padEnd(width, "0");
  const bf = b.fraction.padEnd(width, "0");
  return af === bf ? 0 : af < bf ? -1 : 1;
}

function addTimestampSeconds(value, seconds, name) {
  const parts = timestampParts(value, name);
  positiveInteger(seconds, "seconds");
  const wholeSecond = new Date(Number(parts.second + BigInt(seconds)) * 1000).toISOString().replace(".000Z", "");
  return `${wholeSecond}${parts.fraction ? `.${parts.fraction}` : ""}Z`;
}

function validUnicode(value, name) {
  if (typeof value !== "string" || Buffer.from(value, "utf8").toString("utf8") !== value) fail("validation_failed", `${name} is not valid UTF-8 text`);
}

function validateUtf8Bytes(value, name) {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(value);
  } catch {
    fail("integrity_failed", `${name} is not valid UTF-8`);
  }
}

function validateExcerptHtml(value, canonicalUrl, readMoreUrl, contract) {
  const name = "content_html";
  validUnicode(value, name);
  const parseErrors = [];
  const fragment = parseFragment(value, { onParseError: (error) => parseErrors.push(error.code) });
  if (parseErrors.length > 0) fail("validation_failed", `${name} contains malformed HTML: ${parseErrors[0]}`);
  const htmlNamespace = "http://www.w3.org/1999/xhtml";
  const complexity = contract.resolve.field_rules.excerpt_html_complexity;
  const stack = [...fragment.childNodes].reverse().map((node) => ({ node, depth: node.tagName ? 1 : 0 }));
  let elementCount = 0;
  while (stack.length > 0) {
    const { node, depth } = stack.pop();
    if (node.tagName) {
      elementCount += 1;
      if (elementCount > complexity.maximum_elements || depth > complexity.maximum_depth) fail("validation_failed", "excerpt HTML exceeds complexity limits");
      const rel = node.attrs?.find((attribute) => attribute.name === "rel")?.value ?? "";
      if (["style", "script", "base"].includes(node.tagName) || (node.tagName === "link" && rel.split(/[\t\n\f\r ]+/).some((token) => token.toLowerCase() === "stylesheet"))) {
        fail("validation_failed", "excerpt HTML contains a forbidden element");
      }
    }
    const children = [...(node.childNodes ?? []), ...(node.content?.childNodes ?? [])];
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push({ node: children[index], depth: children[index].tagName ? depth + 1 : depth });
    }
  }

  const topLevelElements = fragment.childNodes.filter((node) => node.tagName);
  if (topLevelElements.length < 2) fail("validation_failed", "excerpt requires a trailing notice and Read More block");
  const notice = topLevelElements.at(-2);
  const linkParagraph = topLevelElements.at(-1);
  if (notice.namespaceURI !== htmlNamespace || notice.tagName !== "p" || notice.attrs.length !== 0 || notice.childNodes.length === 0 || notice.childNodes.some((node) => node.nodeName !== "#text")) fail("validation_failed", "excerpt notice must be an attribute-free text-only paragraph");
  const normalizeText = (text) => text.replace(/\s+/gu, " ").trim();
  if (!/excerpt/i.test(normalizeText(notice.childNodes.map((node) => node.value).join("")))) fail("validation_failed", "excerpt notice must identify the content as an excerpt");
  if (linkParagraph.namespaceURI !== htmlNamespace || linkParagraph.tagName !== "p" || linkParagraph.attrs.length !== 0) fail("validation_failed", "Read More block must be an attribute-free paragraph");
  const linkParagraphElements = linkParagraph.childNodes.filter((node) => node.tagName);
  if (linkParagraphElements.length !== 1 || linkParagraph.childNodes.some((node) => !node.tagName && (node.nodeName !== "#text" || normalizeText(node.value) !== ""))) fail("validation_failed", "Read More paragraph must contain only one link");
  const link = linkParagraphElements[0];
  if (link.namespaceURI !== htmlNamespace || link.tagName !== "a" || link.attrs.length !== 1 || link.attrs[0].name !== "href" || link.childNodes.length === 0 || link.childNodes.some((node) => node.nodeName !== "#text")) fail("validation_failed", "Read More link has invalid structure");
  if (normalizeText(link.childNodes.map((node) => node.value).join("")) !== "Read More") fail("validation_failed", "Read More link has invalid text");
  if (readMoreUrl !== canonicalUrl || link.attrs[0].value !== canonicalUrl) fail("validation_failed", "Read More link must equal the canonical source URL");
}

function pattern(value, source, code = "validation_failed", name = "value") {
  if (typeof value !== "string" || !(new RegExp(source)).test(value)) fail(code, `${name} has invalid format`);
}

function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) fail("validation_failed", `${name} must be a positive integer`);
}

function positiveSigned64Integer(value, name) {
  const validBigInt = typeof value === "bigint" && value > 0n && value <= 9223372036854775807n;
  const validNumber = typeof value === "number" && Number.isSafeInteger(value) && value > 0;
  if (!validBigInt && !validNumber) {
    fail("validation_failed", `${name} must be a positive signed 64-bit integer`);
  }
}

function nonnegativeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) fail("validation_failed", `${name} must be a nonnegative integer`);
}

function boolean(value, name) {
  if (typeof value !== "boolean") fail("validation_failed", `${name} must be boolean`);
}

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim() === "") fail("validation_failed", `${name} must be a nonblank string`);
}

function boundedJsonObject(value, maximum, name) {
  if (bytes(stringifyProtocolJson(value)) > maximum) fail("validation_failed", `${name} exceeds maximum_json_bytes`);
}

function validateBoundedJsonText(text, maximum, name, validator) {
  if (typeof text !== "string") fail("invalid_json", `${name} must be JSON text`);
  if (bytes(text) > maximum) fail("validation_failed", `${name} exceeds maximum_json_bytes`);
  const value = parseProtocolJson(text);
  validator(value);
  return value;
}

function enumValue(value, allowed, name) {
  if (!allowed.includes(value)) fail("validation_failed", `${name} is invalid`);
}

function uniqueStrings(value, name, allowed = null, { nonempty = true } = {}) {
  if (!Array.isArray(value) || (nonempty && value.length === 0)) fail("validation_failed", `${name} must be an array`);
  const seen = new Set();
  for (const item of value) {
    requiredString(item, `${name} item`);
    if (seen.has(item) || (allowed && !allowed.includes(item))) fail("validation_failed", `${name} contains an invalid item`);
    seen.add(item);
  }
}

function httpUrl(value, maximum, name) {
  nonblank(value, maximum, name);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail("validation_failed", `${name} is not a URL`);
  }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) fail("validation_failed", `${name} is not an allowed public URL`);
}

function uuid(value, contract, name) {
  pattern(value, contract.common.uuid_pattern, "validation_failed", name);
}

function optionalNullableString(value, name) {
  if (value !== null) requiredString(value, name);
}

function catalogIdentifier(value, contract, name) {
  nonblank(value, contract.common.opaque_identifier_maximum_bytes, name);
}

function catalogName(value, contract, name) {
  nonblank(value, contract.common.descriptive_name_maximum_bytes, name);
}

function correlation(value, contract) {
  nonblank(value, contract.common.correlation_id_maximum_bytes, "correlation_id");
}

export function validateCorrelationExchange(value, contract) {
  exactObject(value, ["request_header", "response_header", "response_body"], ["request_body"], "correlation exchange");
  correlation(value.request_header, contract);
  correlation(value.response_header, contract);
  correlation(value.response_body, contract);
  if (value.request_header !== value.response_header || value.request_header !== value.response_body) fail("validation_failed");
  if (Object.hasOwn(value, "request_body") && value.request_body !== value.request_header) fail("validation_failed");
}

export function canonicalize(value, code = "validation_failed") {
  if (value === null) return "null";
  if (typeof value === "string") {
    unicodeScalarString(value, code, "canonical JSON string");
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail(code, "canonical JSON number must be finite");
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalize(item, code)).join(",")}]`;
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) fail(code, "canonical JSON value is invalid");
  const keys = Object.keys(value).sort();
  for (const key of keys) unicodeScalarString(key, code, "canonical JSON member name");
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key], code)}`).join(",")}}`;
}

export function validatePresentationMode(mode, contract) {
  if (!contract.configuration.presentation_modes.includes(mode)) fail("validation_failed", "unsupported presentation mode");
}

export function validateConnectionCapability(value, contract) {
  boundedJsonObject(value, contract.connection_capability.maximum_json_bytes, "connection capability");
  exactObject(value, [...contract.connection_capability.required_fields, "correlation_id"], ["forum_name"], "connection capability");
  if (value.contract_version !== contract.version) fail("validation_failed", "wrong contract version");
  pattern(value.connection_id, contract.authentication.connection_id_pattern);
  boolean(value.enabled, "enabled");
  uniqueStrings(value.directions, "directions", ["to_discourse", "from_discourse"]);
  uniqueStrings(value.lanes, "lanes");
  if (value.lanes.length > contract.connection_capability.lanes_maximum_items) fail("validation_failed", "too many capability lanes");
  for (const lane of value.lanes) nonblank(lane, contract.connection_capability.lane_maximum_bytes, "capability lane");
  if (value.directions.includes("from_discourse")) nonblank(value.forum_name, contract.configuration.forum_name.maximum_bytes, "forum_name");
  if (Object.hasOwn(value, "forum_name") && !value.directions.includes("from_discourse")) nonblank(value.forum_name, contract.configuration.forum_name.maximum_bytes, "forum_name");
  uniqueStrings(value.allowed_presentation_modes, "allowed_presentation_modes", contract.configuration.presentation_modes);
  uniqueStrings(value.supported_operations, "supported_operations", contract.connection_capability.supported_operations);
  boolean(value.catalog_required, "catalog_required");
  nonblank(value.policy_revision, contract.common.policy_revision_maximum_bytes, "policy_revision");
  exactObject(value.bounds, contract.connection_capability.bounds_required_fields, [], "bounds");
  const expectedBounds = {
    resolve_json_bytes: contract.resolve.maximum_json_bytes,
    source_content_bytes: contract.common.source_content_maximum_bytes,
    claim_maximum_items: contract.publication_work.claim.maximum_items,
    lease_maximum_seconds: contract.publication_work.claim.maximum_total_lease_seconds,
    catalog_segment_items: contract.platform_catalog.maximum_items_per_segment,
  };
  for (const [field, expected] of Object.entries(expectedBounds)) if (value.bounds[field] !== expected) fail("validation_failed");
  if (!Array.isArray(value.destination_policies) || value.destination_policies.length === 0 || value.destination_policies.length > contract.connection_capability.destination_policies_maximum_items) fail("validation_failed");
  const policyIds = new Set();
  const rules = contract.connection_capability.destination_policy_field_rules;
  for (const policy of value.destination_policies) {
    exactObject(policy, contract.connection_capability.destination_policy_required_fields, [], "destination policy");
    nonblank(policy.destination_policy_id, contract.common.opaque_identifier_maximum_bytes, "destination_policy_id");
    if (policyIds.has(policy.destination_policy_id)) fail("validation_failed", "duplicate destination_policy_id");
    policyIds.add(policy.destination_policy_id);
    if (!contract.profiles.includes(policy.profile)) fail("validation_failed");
    validatePresentationMode(policy.presentation_mode, contract);
    if (!value.allowed_presentation_modes.includes(policy.presentation_mode)) fail("policy_denied", "destination policy presentation is outside effective connection policy");
    exactObject(policy.container_mapping, rules.container_mapping_required_fields, [], "container mapping");
    nonblank(policy.container_mapping.source, contract.common.opaque_identifier_maximum_bytes, "container mapping source");
    nonblank(policy.container_mapping.destination, contract.common.opaque_identifier_maximum_bytes, "container mapping destination");
    exactObject(policy.taxonomy_mapping, rules.taxonomy_mapping_required_fields, rules.taxonomy_mapping_optional_fields, "taxonomy mapping");
    exactObject(policy.author_mapping, rules.author_mapping_required_fields, rules.author_mapping_optional_fields, "author mapping");
    if (!rules.mapping_modes.includes(policy.taxonomy_mapping.mode) || !rules.mapping_modes.includes(policy.author_mapping.mode)) fail("validation_failed");
    if (Object.hasOwn(policy.taxonomy_mapping, "items")) {
      if (!Array.isArray(policy.taxonomy_mapping.items) || policy.taxonomy_mapping.items.length > rules.mapping_items_maximum_items) fail("validation_failed", "taxonomy mapping items must be a bounded array");
      const sourceIds = new Set();
      for (const item of policy.taxonomy_mapping.items) {
        exactObject(item, ["source", "destination"], [], "taxonomy mapping item");
        nonblank(item.source, contract.common.opaque_identifier_maximum_bytes, "taxonomy mapping source");
        nonblank(item.destination, contract.common.opaque_identifier_maximum_bytes, "taxonomy mapping destination");
        if (sourceIds.has(item.source)) fail("validation_failed", "duplicate taxonomy mapping source");
        sourceIds.add(item.source);
      }
    }
    if (Object.hasOwn(policy.author_mapping, "destination_id")) nonblank(policy.author_mapping.destination_id, contract.common.opaque_identifier_maximum_bytes, "author destination_id");
    if (Object.hasOwn(policy.author_mapping, "items")) {
      if (!Array.isArray(policy.author_mapping.items) || policy.author_mapping.items.length > rules.mapping_items_maximum_items) fail("validation_failed", "author mapping items must be a bounded array");
      const sourceIds = new Set();
      for (const item of policy.author_mapping.items) {
        exactObject(item, ["source", "destination"], [], "author mapping item");
        nonblank(item.source, contract.common.opaque_identifier_maximum_bytes, "author mapping source");
        nonblank(item.destination, contract.common.opaque_identifier_maximum_bytes, "author mapping destination");
        if (sourceIds.has(item.source)) fail("validation_failed", "duplicate author mapping source");
        sourceIds.add(item.source);
      }
    }
    exactObject(policy.native_limit_policy, rules.native_limit_policy_required_fields, [], "native limit policy");
    if (!Number.isSafeInteger(policy.native_limit_policy.maximum_bytes) || policy.native_limit_policy.maximum_bytes < 1 || !rules.overflow_behaviors.includes(policy.native_limit_policy.overflow_behavior)) fail("validation_failed");
    nonblank(policy.catalog_revision, contract.common.opaque_identifier_maximum_bytes, "catalog_revision");
  }
  correlation(value.correlation_id, contract);
}

export function validateConnectionCapabilityText(text, contract) {
  return validateBoundedJsonText(text, contract.connection_capability.maximum_json_bytes, "connection capability", (value) => validateConnectionCapability(value, contract));
}

export function validateAuthenticationHeaders(value, contract) {
  exactObject(value, [contract.authentication.connection_header, contract.authentication.secret_header, contract.authentication.contract_header, contract.common.correlation_header], [], "authentication headers");
  pattern(value[contract.authentication.connection_header], contract.authentication.connection_id_pattern);
  nonblank(value[contract.authentication.secret_header], 4096, contract.authentication.secret_header);
  validateContractHeader(value, contract);
  correlation(value[contract.common.correlation_header], contract);
}

export function validateResolveRecord(record, contract) {
  exactObject(record, contract.resolve.required_fields, contract.resolve.optional_fields, "bridge_record");
  if (bytes(stringifyProtocolJson({ bridge_record: record })) > contract.resolve.maximum_json_bytes) fail("validation_failed", "resolve request exceeds maximum_json_bytes");
  if (!contract.resolve.field_rules.direction.includes(record.direction)) fail("direction_denied");
  validatePresentationMode(record.presentation_mode, contract);
  nonblank(record.external_id, contract.resolve.field_rules.external_id_maximum_bytes, "external_id");
  httpUrl(record.canonical_url, contract.resolve.field_rules.canonical_url_maximum_bytes, "canonical_url");
  nonblank(record.title, contract.resolve.field_rules.title_maximum_bytes, "title");
  validUnicode(record.content_html, "content_html");
  if (bytes(record.content_html) > contract.resolve.field_rules.content_html_maximum_bytes) fail("validation_failed", "content_html too large");
  if (!contract.resolve.field_rules.published.includes(record.published)) fail("validation_failed", "published is invalid");
  nonblank(record.source_revision, contract.resolve.field_rules.source_revision_maximum_bytes, "source_revision");
  positiveInteger(record.source_revision_sequence, "source_revision_sequence");
  timestamp(record.source_created_at, "source_created_at");
  timestamp(record.source_updated_at, "source_updated_at");
  pattern(record.source_content_sha256, contract.common.sha256_pattern, "validation_failed", "source_content_sha256");
  if (!Number.isSafeInteger(record.source_content_bytes) || record.source_content_bytes < 0 || record.source_content_bytes > contract.resolve.source_content_maximum_bytes) fail("validation_failed", "source content bound");
  if (record.content_disposition === "complete") {
    if (Object.hasOwn(record, "read_more_url")) fail("validation_failed");
    if (bytes(record.content_html) !== record.source_content_bytes || sha256(record.content_html) !== record.source_content_sha256) fail("integrity_failed");
  } else if (record.content_disposition === "excerpt") {
    validateExcerptHtml(record.content_html, record.canonical_url, record.read_more_url, contract);
    if (record.source_content_bytes <= bytes(record.content_html)) fail("validation_failed");
  } else fail("validation_failed");
  if (Object.hasOwn(record, "lane")) nonblank(record.lane, contract.resolve.field_rules.lane_maximum_bytes, "lane");
  if (Object.hasOwn(record, "adapter_id")) nonblank(record.adapter_id, contract.resolve.field_rules.adapter_id_maximum_bytes, "adapter_id");
  if (Object.hasOwn(record, "adapter_version")) nonblank(record.adapter_version, contract.resolve.field_rules.adapter_version_maximum_bytes, "adapter_version");
  if (Object.hasOwn(record, "visibility")) enumValue(record.visibility, contract.resolve.field_rules.visibility, "visibility");
  if (Object.hasOwn(record, "existing_topic_id")) positiveSigned64Integer(record.existing_topic_id, "existing_topic_id");
  if (Object.hasOwn(record, "source_authors")) {
    if (!Array.isArray(record.source_authors) || record.source_authors.length > contract.resolve.field_rules.source_authors_maximum_items) fail("validation_failed");
    const ids = new Set();
    for (const author of record.source_authors) {
      exactObject(author, contract.authorship_and_taxonomy.source_author_fields, [], "source author");
      nonblank(author.source_author_id, contract.resolve.field_rules.source_author_id_maximum_bytes, "source_author_id");
      nonblank(author.source_author_name, contract.resolve.field_rules.source_author_name_maximum_bytes, "source_author_name");
      httpUrl(author.source_author_url, contract.authorship_and_taxonomy.source_author_url_maximum_bytes, "source_author_url");
      if (ids.has(author.source_author_id)) fail("validation_failed", "duplicate source author");
      ids.add(author.source_author_id);
    }
    if (Object.hasOwn(record, "primary_source_author_id") && !ids.has(record.primary_source_author_id)) fail("validation_failed", "primary source author is not present");
  } else if (Object.hasOwn(record, "primary_source_author_id")) fail("validation_failed", "primary source author requires source_authors");
  correlation(record.correlation_id, contract);
}

export function validateResolveRequestText(text, contract) {
  if (typeof text !== "string") fail("invalid_json", "resolve request must be JSON text");
  if (bytes(text) > contract.resolve.maximum_json_bytes) fail("request_too_large", "resolve request exceeds maximum_json_bytes");
  const envelope = parseProtocolJson(text);
  exactObject(envelope, ["bridge_record"], [], "resolve request");
  validateResolveRecord(envelope.bridge_record, contract);
  return envelope;
}

export function validateResolveResponse(value, fields, contract) {
  exactObject(value, [...fields, "correlation_id"], [], "resolve response");
  enumValue(value.outcome, Object.values(contract.resolve.outcomes), "outcome");
  requiredString(value.reason, "reason");
  enumValue(value.direction, contract.resolve.field_rules.direction, "direction");
  if (Object.hasOwn(value, "accepted_source_revision")) {
    if (![contract.resolve.outcomes[200], contract.resolve.outcomes[201]].includes(value.outcome)) fail("validation_failed");
    uuid(value.resource_id, contract, "resource_id");
    positiveInteger(value.topic_id, "topic_id");
    httpUrl(value.topic_url, contract.resolve.field_rules.canonical_url_maximum_bytes, "topic_url");
    nonblank(value.accepted_source_revision, contract.common.source_revision_maximum_bytes, "accepted_source_revision");
    positiveInteger(value.accepted_source_revision_sequence, "accepted_source_revision_sequence");
  } else {
    if (value.outcome !== contract.resolve.outcomes[409]) fail("validation_failed");
    for (const field of ["resource_id", "topic_id", "topic_url"]) if (value[field] !== null) fail("validation_failed", `${field} must be null for an unresolved conflict`);
    uniqueStrings(value.conflict_fields, "conflict_fields");
  }
  correlation(value.correlation_id, contract);
  if (value.core_fallback !== false) fail("validation_failed");
}

export function validateRecord(record, contract) {
  exactObject(record, contract.records.required_record_fields, contract.records.optional_record_fields, "bridge record");
  uuid(record.resource_id, contract, "resource_id");
  enumValue(record.direction, ["to_discourse", "from_discourse"], "direction");
  requiredString(record.state, "state");
  nonblank(record.title, contract.resolve.field_rules.title_maximum_bytes, "title");
  positiveInteger(record.topic_id, "topic_id");
  httpUrl(record.topic_url, contract.resolve.field_rules.canonical_url_maximum_bytes, "topic_url");
  nonblank(record.source_revision, contract.common.source_revision_maximum_bytes, "source_revision");
  positiveInteger(record.source_revision_sequence, "source_revision_sequence");
  timestamp(record.source_created_at, "source_created_at");
  timestamp(record.source_updated_at, "source_updated_at");
  if (!Array.isArray(record.bindings)) fail("validation_failed");
  for (const binding of record.bindings) {
    const synchronizationFields = contract.records.destination_binding_synchronization_fields;
    const eventTimestamps = contract.records.destination_binding_event_timestamp_fields;
    exactObject(binding, contract.records.destination_binding_required_fields, [...synchronizationFields, ...eventTimestamps], "destination binding");
    pattern(binding.binding_id, contract.records.binding_id_pattern);
    pattern(binding.connection_id, contract.authentication.connection_id_pattern);
    enumValue(binding.role, contract.records.binding_roles, "binding role");
    enumValue(binding.state, contract.records.binding_states, "binding state");
    nonblank(binding.external_id, contract.resolve.field_rules.external_id_maximum_bytes, "binding external_id");
    httpUrl(binding.canonical_url, contract.resolve.field_rules.canonical_url_maximum_bytes, "binding canonical_url");
    validatePresentationMode(binding.presentation_mode, contract);
    enumValue(binding.content_disposition, ["complete", "excerpt"], "binding content_disposition");
    enumValue(binding.deployment_state, contract.records.deployment_states, "deployment_state");
    enumValue(binding.verification_state, contract.records.verification_states, "verification_state");
    const synchronizationCount = synchronizationFields.filter((field) => Object.hasOwn(binding, field)).length;
    if (synchronizationCount !== 0 && synchronizationCount !== synchronizationFields.length) fail("validation_failed", "synchronization fields must occur together");
    const awaitingFirstAcknowledgement = synchronizationCount === 0;
    if (!awaitingFirstAcknowledgement && synchronizationCount !== synchronizationFields.length) fail("validation_failed", "synchronization fields are required after synchronization");
    if (synchronizationCount === synchronizationFields.length) {
      nonblank(binding.applied_source_revision, contract.common.source_revision_maximum_bytes, "applied_source_revision");
      nonblank(binding.publication_revision, contract.common.publication_revision_maximum_bytes, "publication_revision");
      timestamp(binding.synchronized_at, "synchronized_at");
    }
    if (binding.deployment_state === "deployed") timestamp(binding.deployed_at, "deployed_at");
    else if (Object.hasOwn(binding, "deployed_at")) fail("validation_failed", "deployed_at must be absent until deployed");
    if (binding.verification_state === "verified") {
      if (binding.deployment_state !== "deployed") fail("validation_failed", "verified binding must be deployed");
      timestamp(binding.publicly_verified_at, "publicly_verified_at");
    } else if (Object.hasOwn(binding, "publicly_verified_at")) fail("validation_failed", "publicly_verified_at must be absent until verified");
    if (binding.deployment_state === "not_required" && binding.verification_state !== "not_required") fail("validation_failed");
  }
  if (Object.hasOwn(record, "content_disposition")) enumValue(record.content_disposition, ["complete", "excerpt"], "content_disposition");
  if (Object.hasOwn(record, "content_transport")) validateTransport(record.content_transport, contract);
}

export function validateRecordIndex(value, contract) {
  exactObject(value, contract.records.index_required_response_fields, [], "record index");
  if (!Array.isArray(value.records) || value.records.length > contract.records.records_per_page) fail("validation_failed");
  for (const record of value.records) validateRecord(record, contract);
  positiveInteger(value.page, "page");
  positiveInteger(value.total_pages, "total_pages");
  if (value.page > contract.records.maximum_page || value.total_pages > contract.records.maximum_page || value.page > value.total_pages) fail("validation_failed");
  correlation(value.correlation_id, contract);
}

export function validateRecordShow(value, contract) {
  exactObject(value, contract.records.show_required_response_fields, [], "record show");
  validateRecord(value.bridge_record, contract);
  correlation(value.correlation_id, contract);
}

export function validateInventory(value, contract) {
  exactObject(value, contract.source_publication.inventory.required_response_fields, [], "inventory");
  if (!Array.isArray(value.items) || value.items.length > contract.source_publication.inventory.maximum_limit) fail("validation_failed");
  for (const item of value.items) {
    exactObject(item, contract.source_publication.inventory.required_item_fields, [], "inventory item");
    uuid(item.resource_id, contract, "resource_id");
    positiveInteger(item.topic_id, "topic_id");
    httpUrl(item.topic_url, contract.resolve.field_rules.canonical_url_maximum_bytes, "topic_url");
    nonblank(item.title, contract.resolve.field_rules.title_maximum_bytes, "title");
    nonblank(item.source_revision, contract.common.source_revision_maximum_bytes, "source_revision");
    positiveInteger(item.source_revision_sequence, "source_revision_sequence");
    timestamp(item.source_created_at, "source_created_at");
    timestamp(item.source_updated_at, "source_updated_at");
  }
  requiredString(value.snapshot, "snapshot");
  nonblank(value.policy_revision, contract.common.policy_revision_maximum_bytes, "policy_revision");
  optionalNullableString(value.next_cursor, "next_cursor");
  boolean(value.complete, "complete");
  correlation(value.correlation_id, contract);
}

function validateTransport(transport, contract) {
  object(transport, "content_transport");
  if (transport.mode === "inline") {
    exactObject(transport, contract.source_publication.content_transport.inline.required_fields, [], "inline transport");
    if (transport.media_type !== "text/html; charset=utf-8") fail("validation_failed");
    nonnegativeInteger(transport.byte_length, "byte_length");
    pattern(transport.sha256, contract.common.sha256_pattern, "validation_failed", "sha256");
    validUnicode(transport.content_html, "content_html");
    if (bytes(transport.content_html) !== transport.byte_length || sha256(transport.content_html) !== transport.sha256) fail("integrity_failed");
    if (transport.byte_length > contract.source_publication.content_transport.inline.maximum_content_html_bytes) fail("validation_failed");
  } else if (transport.mode === "chunked") {
    exactObject(transport, contract.source_publication.content_transport.chunked.required_descriptor_fields, [], "chunked descriptor");
    if (transport.media_type !== "text/html; charset=utf-8") fail("validation_failed");
    nonnegativeInteger(transport.byte_length, "byte_length");
    if (transport.byte_length > contract.source_publication.detail.maximum_source_content_bytes) fail("validation_failed");
    pattern(transport.sha256, contract.common.sha256_pattern);
    positiveInteger(transport.chunk_count, "chunk_count");
    if (transport.decoded_chunk_maximum_bytes !== contract.source_publication.content_transport.chunked.decoded_chunk_maximum_bytes) fail("validation_failed");
  } else fail("validation_failed");
}

export function validateSourceDetail(value, contract) {
  boundedJsonObject(value, contract.source_publication.detail.maximum_json_bytes, "source detail");
  exactObject(value, contract.source_publication.detail.required_fields, [], "source detail");
  uuid(value.resource_id, contract, "resource_id");
  positiveInteger(value.topic_id, "topic_id");
  httpUrl(value.topic_url, contract.resolve.field_rules.canonical_url_maximum_bytes, "topic_url");
  nonblank(value.title, contract.resolve.field_rules.title_maximum_bytes, "title");
  nonblank(value.source_revision, contract.common.source_revision_maximum_bytes, "source_revision");
  positiveInteger(value.source_revision_sequence, "source_revision_sequence");
  timestamp(value.source_created_at, "source_created_at");
  timestamp(value.source_updated_at, "source_updated_at");
  validatePresentationMode(value.presentation_mode, contract);
  if (!Array.isArray(value.source_authors) || value.source_authors.length > contract.source_publication.detail.source_authors_maximum_items) fail("validation_failed");
  if (!Array.isArray(value.categories) || value.categories.length > contract.source_publication.detail.categories_maximum_items) fail("validation_failed");
  if (!Array.isArray(value.tags) || value.tags.length > contract.source_publication.detail.tags_maximum_items) fail("validation_failed");
  for (const author of value.source_authors) {
    exactObject(author, contract.authorship_and_taxonomy.source_author_fields, [], "source author");
    nonblank(author.source_author_id, contract.authorship_and_taxonomy.source_author_id_maximum_bytes, "source_author_id");
    nonblank(author.source_author_name, contract.authorship_and_taxonomy.source_author_name_maximum_bytes, "source_author_name");
    httpUrl(author.source_author_url, contract.authorship_and_taxonomy.source_author_url_maximum_bytes, "source_author_url");
  }
  const categoryIds = new Set();
  for (const category of value.categories) {
    exactObject(category, contract.authorship_and_taxonomy.category_fields, [], "source category");
    nonblank(category.source_category_id, contract.common.opaque_identifier_maximum_bytes, "source_category_id");
    nonblank(category.source_category_name, contract.common.descriptive_name_maximum_bytes, "source_category_name");
    if (category.source_parent_category_id !== null) nonblank(category.source_parent_category_id, contract.common.opaque_identifier_maximum_bytes, "source_parent_category_id");
    if (categoryIds.has(category.source_category_id)) fail("validation_failed", "duplicate source category");
    categoryIds.add(category.source_category_id);
  }
  const tagIds = new Set();
  for (const tag of value.tags) {
    exactObject(tag, contract.authorship_and_taxonomy.tag_fields, [], "source tag");
    nonblank(tag.source_tag_id, contract.common.opaque_identifier_maximum_bytes, "source_tag_id");
    nonblank(tag.source_tag_name, contract.common.descriptive_name_maximum_bytes, "source_tag_name");
    if (tagIds.has(tag.source_tag_id)) fail("validation_failed", "duplicate source tag");
    tagIds.add(tag.source_tag_id);
  }
  validateTransport(value.content_transport, contract);
  enumValue(value.content_disposition, ["complete", "excerpt"], "content_disposition");
  if (value.network_provenance !== null) validateNetwork(value.network_provenance, contract, null);
  correlation(value.correlation_id, contract);
}

export function validateSourceDetailText(text, contract) {
  return validateBoundedJsonText(text, contract.source_publication.detail.maximum_json_bytes, "source detail", (value) => validateSourceDetail(value, contract));
}

export function validateChunk(value, descriptor, contract) {
  exactObject(value, contract.source_publication.content_transport.chunked.required_chunk_fields, ["correlation_id"], "content chunk");
  nonblank(value.source_revision, contract.common.source_revision_maximum_bytes, "source_revision");
  positiveInteger(value.chunk, "chunk");
  positiveInteger(value.chunk_count, "chunk_count");
  if (value.chunk > value.chunk_count) fail("validation_failed");
  nonnegativeInteger(value.decoded_bytes, "decoded_bytes");
  pattern(value.chunk_sha256, contract.common.sha256_pattern, "validation_failed", "chunk_sha256");
  if (typeof value.content_base64 !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.content_base64)) fail("validation_failed", "content_base64 is not canonical base64");
  const decoded = Buffer.from(value.content_base64, "base64");
  if (decoded.length !== value.decoded_bytes || sha256(decoded) !== value.chunk_sha256) fail("integrity_failed");
  if (value.decoded_bytes > contract.source_publication.content_transport.chunked.decoded_chunk_maximum_bytes) fail("validation_failed");
  if (descriptor) {
    if (value.source_revision !== descriptor.source_revision || value.chunk_count !== descriptor.chunk_count) fail("revision_conflict");
  }
  if (Object.hasOwn(value, "correlation_id")) correlation(value.correlation_id, contract);
}

export function validateChunkSet(descriptor, chunks, contract) {
  const ordered = [...chunks].sort((a, b) => a.chunk - b.chunk);
  if (ordered.length !== descriptor.chunk_count) fail("integrity_failed");
  for (let index = 0; index < ordered.length; index += 1) {
    const chunk = ordered[index];
    validateChunk(chunk, descriptor, contract);
    if (chunk.chunk !== index + 1) fail("integrity_failed", "chunk sequence is incomplete or duplicated");
  }
  const complete = Buffer.concat(ordered.map((chunk) => Buffer.from(chunk.content_base64, "base64")));
  if (complete.length !== descriptor.byte_length || sha256(complete) !== descriptor.sha256) fail("integrity_failed");
  validateUtf8Bytes(complete, "reassembled content");
}

export function validateWork(value, contract) {
  boundedJsonObject(value, contract.publication_work.maximum_json_bytes, "publication work");
  exactObject(value, contract.publication_work.work_required_fields, [], "publication work");
  pattern(value.work_id, contract.publication_work.work_id_pattern);
  uuid(value.resource_id, contract, "resource_id");
  pattern(value.connection_id, contract.authentication.connection_id_pattern);
  pattern(value.lease_token, contract.publication_work.lease_token_pattern, "reconciliation_required", "lease_token");
  pattern(value.stage_token, contract.publication_work.stage_token_pattern, "stage_conflict", "stage_token");
  if (!contract.publication_work.actions.includes(value.action)) fail("validation_failed");
  nonblank(value.source_revision, contract.common.source_revision_maximum_bytes, "source_revision");
  nonblank(value.policy_revision, contract.common.policy_revision_maximum_bytes, "policy_revision");
  nonblank(value.destination_policy_id, contract.common.opaque_identifier_maximum_bytes, "destination_policy_id");
  nonblank(value.catalog_revision, contract.common.opaque_identifier_maximum_bytes, "catalog_revision");
  validatePresentationMode(value.presentation_mode, contract);
  const mappingRules = contract.publication_work.resolved_mapping_rules;
  exactObject(value.resolved_container, mappingRules.container_required_fields, [], "resolved container");
  nonblank(value.resolved_container.id, contract.common.opaque_identifier_maximum_bytes, "resolved container id");
  nonblank(value.resolved_container.kind, mappingRules.container_kind_maximum_bytes, "resolved container kind");
  if (!Array.isArray(value.resolved_taxonomy) || value.resolved_taxonomy.length > mappingRules.taxonomy_maximum_items) fail("validation_failed");
  const taxonomySourceIds = new Set();
  for (const item of value.resolved_taxonomy) {
    exactObject(item, mappingRules.taxonomy_item_required_fields, [], "resolved taxonomy item");
    nonblank(item.source_id, contract.common.opaque_identifier_maximum_bytes, "taxonomy source_id");
    nonblank(item.destination_id, contract.common.opaque_identifier_maximum_bytes, "taxonomy destination_id");
    if (taxonomySourceIds.has(item.source_id)) fail("validation_failed", "duplicate taxonomy source_id");
    taxonomySourceIds.add(item.source_id);
  }
  exactObject(value.resolved_author, mappingRules.author_required_fields, [], "resolved author");
  enumValue(value.resolved_author.mode, contract.connection_capability.destination_policy_field_rules.mapping_modes, "resolved author mode");
  if (value.resolved_author.destination_id !== null) nonblank(value.resolved_author.destination_id, contract.common.opaque_identifier_maximum_bytes, "resolved author destination_id");
  exactObject(value.native_limit_policy, mappingRules.native_limit_policy_required_fields, [], "native limit policy");
  if (!Number.isSafeInteger(value.native_limit_policy.maximum_bytes) || value.native_limit_policy.maximum_bytes < 1 || !contract.connection_capability.destination_policy_field_rules.overflow_behaviors.includes(value.native_limit_policy.overflow_behavior)) fail("validation_failed");
  positiveInteger(value.source_revision_sequence, "source_revision_sequence");
  if (!Number.isSafeInteger(value.attempt_count) || value.attempt_count < 1 || value.attempt_count > contract.publication_work.maximum_total_attempts) fail("validation_failed");
  if (!Number.isSafeInteger(value.retry_generation) || value.retry_generation < 0) fail("validation_failed");
  timestamp(value.lease_expires_at, "lease_expires_at");
  correlation(value.correlation_id, contract);
}

export function validateWorkText(text, contract) {
  return validateBoundedJsonText(text, contract.publication_work.maximum_json_bytes, "publication work", (value) => validateWork(value, contract));
}

export function validateClaimRequest(value, contract) {
  exactObject(value, contract.publication_work.claim.request_required_fields, contract.publication_work.claim.request_optional_fields, "claim request");
  nonblank(value.worker_id, contract.publication_work.worker_id_maximum_bytes, "worker_id");
  if (Object.hasOwn(value, "maximum_items") && (!Number.isSafeInteger(value.maximum_items) || value.maximum_items < 1 || value.maximum_items > contract.publication_work.claim.maximum_items)) fail("validation_failed");
  if (Object.hasOwn(value, "requested_lease_seconds") && (!Number.isSafeInteger(value.requested_lease_seconds) || value.requested_lease_seconds < 1 || value.requested_lease_seconds > contract.publication_work.claim.maximum_requested_lease_seconds)) fail("validation_failed");
  correlation(value.correlation_id, contract);
}

export function validateClaimResponse(value, contract, request = null) {
  exactObject(value, contract.publication_work.claim.response_required_fields, [], "claim response");
  if (!Array.isArray(value.publication_work) || value.publication_work.length > contract.publication_work.claim.maximum_items) fail("validation_failed");
  for (const item of value.publication_work) validateWork(item, contract);
  timestamp(value.claimed_at, "claimed_at");
  const maximumInitialExpiry = addTimestampSeconds(value.claimed_at, contract.publication_work.claim.maximum_requested_lease_seconds, "claimed_at");
  for (const item of value.publication_work) {
    if (compareTimestamps(item.lease_expires_at, value.claimed_at, "lease_expires_at", "claimed_at") <= 0) fail("work_expired");
    if (compareTimestamps(item.lease_expires_at, maximumInitialExpiry, "lease_expires_at", "maximum initial lease expiry") > 0) fail("lease_limit_exceeded");
  }
  if (request !== null) {
    validateClaimRequest(request, contract);
    if (request.correlation_id !== value.correlation_id) fail("validation_failed", "claim correlation mismatch");
    const maximumItems = request.maximum_items ?? contract.publication_work.claim.default_maximum_items;
    if (value.publication_work.length > maximumItems) fail("validation_failed", "claim returned too many items");
    const grantedSeconds = request.requested_lease_seconds ?? contract.publication_work.claim.default_lease_seconds;
    const expectedExpiry = addTimestampSeconds(value.claimed_at, grantedSeconds, "claimed_at");
    for (const item of value.publication_work) if (compareTimestamps(item.lease_expires_at, expectedExpiry, "lease_expires_at", "requested lease expiry") > 0) fail("validation_failed", "claim lease exceeds request");
  }
  correlation(value.correlation_id, contract);
}

export function validateClaimResponseText(text, contract, request = null) {
  if (typeof text !== "string") fail("invalid_json", "claim response must be JSON text");
  const rawWorkItems = topLevelArrayElementTexts(text, "publication_work", contract.publication_work.maximum_json_bytes, contract.publication_work.claim.maximum_items);
  if (rawWorkItems === null) fail("validation_failed", "claim response.publication_work is required");
  validateJsonText(text);
  const value = parseProtocolJson(text);
  validateClaimResponse(value, contract, request);
  if (rawWorkItems.length !== value.publication_work.length) fail("validation_failed", "raw publication work count mismatch");
  return value;
}

export function validateRenewal(value, contract, context) {
  exactObject(value, ["request", "response"], [], "renewal exchange");
  exactObject(value.request, contract.publication_work.renew.required_fields, [], "renewal request");
  exactObject(value.response, contract.publication_work.renew.response_required_fields, [], "renewal response");
  pattern(value.request.lease_token, contract.publication_work.lease_token_pattern, "reconciliation_required", "lease_token");
  if (!Number.isSafeInteger(value.request.requested_lease_seconds) || value.request.requested_lease_seconds < 1 || value.request.requested_lease_seconds > contract.publication_work.claim.maximum_requested_lease_seconds) fail("validation_failed");
  pattern(value.response.work_id, contract.publication_work.work_id_pattern);
  timestamp(value.response.lease_expires_at, "lease_expires_at");
  validateLeaseRenewal(0, value.response.total_lease_seconds, contract.publication_work.claim.maximum_total_lease_seconds);
  if (value.request.correlation_id !== value.response.correlation_id) fail("validation_failed");
  object(context, "renewal context");
  exactObject(context, ["work", "state", "claimed_at", "request_received_at", "current_total_lease_seconds"], [], "renewal context");
  if (context.state !== "leased") fail("lease_conflict");
  if (value.request.lease_token !== context.work.lease_token || value.response.work_id !== context.work.work_id) fail("lease_conflict");
  validateLeaseTime(context.work.lease_expires_at, context.request_received_at);
  nonnegativeInteger(context.current_total_lease_seconds, "current_total_lease_seconds");
  timestamp(context.claimed_at, "claimed_at");
  timestamp(context.request_received_at, "request_received_at");
  if (compareTimestamps(context.request_received_at, context.claimed_at, "request_received_at", "claimed_at") < 0) fail("validation_failed");
  if (compareTimestamps(context.work.lease_expires_at, addTimestampSeconds(context.claimed_at, context.current_total_lease_seconds, "claimed_at"), "lease_expires_at", "expected current lease expiry") !== 0) fail("validation_failed", "current lease total does not match claimed lease");
  validateLeaseRenewal(context.current_total_lease_seconds, value.request.requested_lease_seconds, contract.publication_work.claim.maximum_total_lease_seconds);
  if (value.response.total_lease_seconds !== context.current_total_lease_seconds + value.request.requested_lease_seconds) fail("validation_failed", "total lease seconds do not match renewal");
  const expectedExpiry = addTimestampSeconds(context.work.lease_expires_at, value.request.requested_lease_seconds, "lease_expires_at");
  if (compareTimestamps(value.response.lease_expires_at, expectedExpiry, "response.lease_expires_at", "expected lease expiry") !== 0) fail("validation_failed", "lease expiry does not match renewal");
  correlation(value.request.correlation_id, contract);
}

export function validateAcknowledgement(value, contract) {
  exactObject(value, contract.publication_work.acknowledgement.required_fields, contract.publication_work.acknowledgement.conditional_fields, "acknowledgement");
  pattern(value.lease_token, contract.publication_work.lease_token_pattern, "reconciliation_required", "lease_token");
  pattern(value.stage_token, contract.publication_work.stage_token_pattern, "stage_conflict", "stage_token");
  if (!contract.publication_work.acknowledgement.stages.includes(value.stage)) fail("stage_conflict");
  if (!contract.publication_work.actions.includes(value.action)) fail("validation_failed");
  uuid(value.resource_id, contract, "resource_id");
  nonblank(value.source_revision, contract.common.source_revision_maximum_bytes, "source_revision");
  positiveInteger(value.source_revision_sequence, "source_revision_sequence");
  nonblank(value.policy_revision, contract.common.policy_revision_maximum_bytes, "policy_revision");
  requiredString(value.destination_policy_id, "destination_policy_id");
  timestamp(value.synchronized_at, "synchronized_at");
  if (value.stage === "synchronized") {
    if (value.deployment_state === "not_required") {
      if (value.verification_state !== "not_required") fail("validation_failed");
    } else if (value.deployment_state !== "pending" || value.verification_state !== "pending") fail("validation_failed");
    if (Object.hasOwn(value, "deployed_at") || Object.hasOwn(value, "publicly_verified_at")) fail("validation_failed");
  } else if (value.stage === "deployed") {
    if (value.deployment_state !== "deployed" || value.verification_state !== "pending") fail("validation_failed");
    timestamp(value.deployed_at, "deployed_at");
    if (compareTimestamps(value.deployed_at, value.synchronized_at, "deployed_at", "synchronized_at") < 0) fail("validation_failed", "deployment cannot precede synchronization");
    if (Object.hasOwn(value, "publicly_verified_at")) fail("validation_failed");
  } else {
    if (value.deployment_state !== "deployed" || value.verification_state !== "verified") fail("validation_failed");
    timestamp(value.deployed_at, "deployed_at");
    timestamp(value.publicly_verified_at, "publicly_verified_at");
    if (compareTimestamps(value.deployed_at, value.synchronized_at, "deployed_at", "synchronized_at") < 0 || compareTimestamps(value.publicly_verified_at, value.deployed_at, "publicly_verified_at", "deployed_at") < 0) fail("validation_failed", "publication events are out of order");
  }
  exactObject(value.destination_binding, ["binding_id", "external_id", "canonical_url", "publication_revision", "content_disposition"], [], "destination_binding");
  pattern(value.destination_binding.binding_id, contract.records.binding_id_pattern);
  nonblank(value.destination_binding.external_id, contract.resolve.field_rules.external_id_maximum_bytes, "destination_binding.external_id");
  httpUrl(value.destination_binding.canonical_url, contract.resolve.field_rules.canonical_url_maximum_bytes, "destination_binding.canonical_url");
  nonblank(value.destination_binding.publication_revision, contract.common.publication_revision_maximum_bytes, "destination_binding.publication_revision");
  if (!["complete", "excerpt"].includes(value.destination_binding.content_disposition)) fail("validation_failed");
  correlation(value.correlation_id, contract);
}

export function validateStageTransition(previous, next, previousResponse) {
  const order = ["synchronized", "deployed", "verified"];
  if (order.indexOf(next.stage) !== order.indexOf(previous.stage) + 1) fail("stage_conflict");
  object(previousResponse, "previous acknowledgement response");
  if (previousResponse.accepted_stage !== previous.stage || previousResponse.terminal !== false || !Object.hasOwn(previousResponse, "next_stage_token")) fail("stage_conflict");
  if (previous.deployment_state === "not_required" || previous.verification_state === "not_required") fail("stage_conflict", "terminal dynamic acknowledgement cannot advance");
  for (const field of ["resource_id", "source_revision", "source_revision_sequence", "policy_revision", "destination_policy_id", "action"]) {
    if (canonicalize(previous[field]) !== canonicalize(next[field])) fail("revision_conflict");
  }
  if (canonicalize(previous.destination_binding) !== canonicalize(next.destination_binding)) fail("identity_conflict");
  if (next.synchronized_at !== previous.synchronized_at) fail("identity_conflict");
  if (previous.stage === "deployed" && next.deployed_at !== previous.deployed_at) fail("identity_conflict");
  pattern(previousResponse.next_stage_token, "^[a-f0-9]{64}$", "stage_conflict", "issued next_stage_token");
  if (next.stage_token !== previousResponse.next_stage_token || previous.stage_token === next.stage_token) fail("stage_conflict");
}

export function validateAcknowledgementResponse(value, contract, context = undefined) {
  exactObject(value, contract.publication_work.acknowledgement.response_required_fields, contract.publication_work.acknowledgement.response_conditional_fields, "acknowledgement response");
  pattern(value.work_id, contract.publication_work.work_id_pattern);
  if (!contract.publication_work.acknowledgement.stages.includes(value.accepted_stage)) fail("stage_conflict");
  if (typeof value.terminal !== "boolean") fail("validation_failed");
  if (value.terminal) {
    if (!["synchronized", "verified"].includes(value.accepted_stage)) fail("stage_conflict");
    if (value.resulting_state !== "acknowledged" || Object.hasOwn(value, "next_stage_token")) fail("stage_conflict");
  } else {
    if (!["synchronized", "deployed"].includes(value.accepted_stage)) fail("stage_conflict");
    if (!Object.hasOwn(value, "next_stage_token")) fail("stage_conflict");
    pattern(value.next_stage_token, contract.publication_work.stage_token_pattern, "stage_conflict", "next_stage_token");
    const expected = value.accepted_stage === "synchronized" ? "awaiting_deployment" : "awaiting_verification";
    if (value.resulting_state !== expected) fail("stage_conflict");
  }
  correlation(value.correlation_id, contract);
  if (context !== undefined) {
    exactObject(context, ["work", "acknowledgement", "destination_mode"], [], "acknowledgement response context");
    object(context.work, "acknowledgement response work");
    object(context.acknowledgement, "acknowledgement response request");
    enumValue(context.destination_mode, ["dynamic", "static"], "destination_mode");
    if (value.work_id !== context.work.work_id) fail("identity_conflict", "acknowledgement response names another work item");
    if (value.accepted_stage !== context.acknowledgement.stage) fail("stage_conflict", "acknowledgement response accepted stage does not match request");
    const acknowledgementClaimsDynamic = context.acknowledgement.stage === "synchronized"
      && context.acknowledgement.deployment_state === "not_required"
      && context.acknowledgement.verification_state === "not_required";
    if (context.destination_mode === "dynamic" && !acknowledgementClaimsDynamic) fail("stage_conflict", "dynamic destination requires terminal synchronized acknowledgement");
    if (context.destination_mode === "static" && acknowledgementClaimsDynamic) fail("stage_conflict", "static destination requires deployment and verification");
    const expectedTerminal = context.destination_mode === "dynamic" || context.acknowledgement.stage === "verified";
    if (value.terminal !== expectedTerminal) fail("stage_conflict", "acknowledgement response terminal state does not match request");
  }
}

export function validateAcknowledgementExchange(work, acknowledgement, response, contract, state, acceptanceContext) {
  validateWork(work, contract);
  validateAcknowledgement(acknowledgement, contract);
  validateAcknowledgementIdentity(work, acknowledgement, state, acceptanceContext);
  validateAcknowledgementResponse(response, contract, { work, acknowledgement, destination_mode: acceptanceContext.destination_mode });
}

export function validateFailure(value, contract) {
  exactObject(value, contract.publication_work.failure.required_fields, [], "failure");
  pattern(value.lease_token, contract.publication_work.lease_token_pattern, "reconciliation_required", "lease_token");
  if (![...contract.failure_registry.retryable, ...contract.failure_registry.terminal].includes(value.error_code)) fail("validation_failed");
  nonblank(value.error_detail, contract.common.error_detail_maximum_bytes, "error_detail");
  if (value.error_detail.includes(value.lease_token)) fail("secret_exposure");
  timestamp(value.failed_at, "failed_at");
  correlation(value.correlation_id, contract);
}

function validateCatalogItems(segmentType, items, contract) {
  if (!contract.platform_catalog.segment_types.includes(segmentType)) fail("validation_failed");
  if (!Array.isArray(items) || items.length > contract.platform_catalog.maximum_items_per_segment) fail("validation_failed");
  const fields = contract.platform_catalog.item_schemas[segmentType];
  const ids = new Set();
  for (const item of items) {
    exactObject(item, fields, [], `${segmentType} item`);
    catalogIdentifier(item.id, contract, "catalog item id");
    if (ids.has(item.id)) fail("validation_failed");
    ids.add(item.id);
    catalogName(item.name, contract, "catalog item name");
    if (typeof item.available !== "boolean") fail("validation_failed");
    if (segmentType === "containers") nonblank(item.kind, contract.platform_catalog.container_kind_maximum_bytes, "container kind");
    if (segmentType === "taxonomies") boolean(item.hierarchical, "taxonomy hierarchical");
    if (segmentType === "terms") {
      catalogIdentifier(item.taxonomy_id, contract, "taxonomy_id");
      if (item.parent_id !== null) catalogIdentifier(item.parent_id, contract, "parent_id");
    }
    if (segmentType === "presentation_modes") validatePresentationMode(item.id, contract);
    if (segmentType === "native_limits" && (!Number.isSafeInteger(item.maximum_bytes) || item.maximum_bytes < 1 || !["complete", "excerpt_with_read_more", "operator_attention"].includes(item.overflow_behavior))) fail("validation_failed");
  }
}

export function validateCatalogSegment(value, contract) {
  exactObject(value, contract.platform_catalog.get_required_response_fields, [], "catalog segment");
  if (bytes(JSON.stringify(value)) > contract.platform_catalog.maximum_json_bytes) fail("validation_failed", "catalog response exceeds maximum_json_bytes");
  catalogIdentifier(value.catalog_revision, contract, "catalog_revision");
  enumValue(value.platform_profile, contract.profiles, "platform_profile");
  validateCatalogItems(value.segment_type, value.items, contract);
  optionalNullableString(value.next_cursor, "next_cursor");
  boolean(value.complete, "complete");
  correlation(value.correlation_id, contract);
}

export function validateCatalogSegmentText(text, contract) {
  return validateBoundedJsonText(text, contract.platform_catalog.maximum_json_bytes, "catalog response", (value) => validateCatalogSegment(value, contract));
}

export function validateCatalogUpdateRequest(value, contract, currentRevision = null) {
  exactObject(value, contract.platform_catalog.put_required_request_fields, [], "catalog update request");
  if (bytes(JSON.stringify(value)) > contract.platform_catalog.maximum_json_bytes) fail("validation_failed", "catalog request exceeds maximum_json_bytes");
  enumValue(value.platform_profile, contract.profiles, "request platform_profile");
  catalogIdentifier(value.base_catalog_revision, contract, "base_catalog_revision");
  if (!Array.isArray(value.segments) || value.segments.length === 0) fail("validation_failed");
  correlation(value.correlation_id, contract);
  if (currentRevision !== null && value.base_catalog_revision !== currentRevision) fail("catalog_revision_conflict");
  const segmentTypes = new Set();
  for (const segment of value.segments) {
    exactObject(segment, contract.platform_catalog.segment_required_fields, [], "catalog update segment");
    if (!contract.platform_catalog.segment_types.includes(segment.segment_type)) fail("validation_failed");
    if (segmentTypes.has(segment.segment_type)) fail("validation_failed", "duplicate catalog segment");
    segmentTypes.add(segment.segment_type);
    validateCatalogItems(segment.segment_type, segment.items, contract);
  }
  return segmentTypes;
}

export function validateCatalogUpdateResponse(value, request, contract, validatedSegmentTypes = null) {
  const segmentTypes = validatedSegmentTypes ?? validateCatalogUpdateRequest(request, contract);
  exactObject(value, contract.platform_catalog.put_required_response_fields, [], "catalog update response");
  enumValue(value.platform_profile, contract.profiles, "response platform_profile");
  if (request.platform_profile !== value.platform_profile) fail("validation_failed");
  catalogIdentifier(value.catalog_revision, contract, "catalog_revision");
  uniqueStrings(value.accepted_segments, "accepted_segments", contract.platform_catalog.segment_types);
  if (request.correlation_id !== value.correlation_id) fail("validation_failed");
  if (canonicalize([...segmentTypes].sort()) !== canonicalize([...value.accepted_segments].sort())) fail("validation_failed", "accepted_segments mismatch");
}

export function validateCatalogUpdate(value, contract, currentRevision = null) {
  exactObject(value, ["request", "response"], [], "catalog update exchange");
  const segmentTypes = validateCatalogUpdateRequest(value.request, contract, currentRevision);
  validateCatalogUpdateResponse(value.response, value.request, contract, segmentTypes);
}

export function validateCatalogUpdateText(text, contract, currentRevision = null) {
  return validateBoundedJsonText(text, contract.platform_catalog.maximum_json_bytes, "catalog request", (value) => validateCatalogUpdateRequest(value, contract, currentRevision));
}

export function validateCatalogCursor(request, binding) {
  for (const field of ["connection_id", "platform_profile", "segment_type", "catalog_revision"]) {
    if (request[field] !== binding[field]) fail("cursor_snapshot_mismatch");
  }
}

export function validateRevocationCursor(request, binding) {
  for (const field of ["connection_id", "high_water", "policy_revision"]) {
    if (request[field] !== binding[field]) fail("cursor_snapshot_mismatch");
  }
}

export function validateResolvedPolicy(policy, catalogItems) {
  const available = new Map(catalogItems.map((item) => [item.id, item.available]));
  const directAuthor = policy.author_mapping?.destination_id ? [{ destination: policy.author_mapping.destination_id }] : [];
  for (const mapping of [policy.container_mapping, ...(policy.taxonomy_mapping?.items ?? []), ...(policy.author_mapping?.items ?? []), ...directAuthor]) {
    if (mapping?.destination && available.get(mapping.destination) !== true) fail("policy_denied");
  }
}

export function validateRevocationDetail(value, contract) {
  exactObject(value, contract.source_publication.revocations.detail_required_fields, [], "revocation detail");
  pattern(value.revocation_id, contract.source_publication.revocations.revocation_id_pattern);
  uuid(value.resource_id, contract, "resource_id");
  nonblank(value.source_revision, contract.common.source_revision_maximum_bytes, "source_revision");
  positiveInteger(value.source_revision_sequence, "source_revision_sequence");
  if (!contract.source_publication.revocations.reasons.includes(value.reason)) fail("validation_failed");
  timestamp(value.effective_at, "effective_at");
  boolean(value.restorable, "restorable");
  uniqueStrings(value.affected_binding_ids, "affected_binding_ids", null, { nonempty: false });
  for (const bindingId of value.affected_binding_ids) pattern(bindingId, contract.records.binding_id_pattern);
  nonblank(value.policy_revision, contract.common.policy_revision_maximum_bytes, "policy_revision");
  correlation(value.correlation_id, contract);
}

export function validateRevocationIndex(value, contract) {
  exactObject(value, contract.source_publication.revocations.index_required_fields, [], "revocation index");
  if (!Array.isArray(value.items) || value.items.length > contract.source_publication.revocations.maximum_limit) fail("validation_failed");
  for (const item of value.items) {
    exactObject(item, contract.source_publication.revocations.item_required_fields, [], "revocation item");
    pattern(item.revocation_id, contract.source_publication.revocations.revocation_id_pattern);
    uuid(item.resource_id, contract, "resource_id");
    nonblank(item.source_revision, contract.common.source_revision_maximum_bytes, "source_revision");
    positiveInteger(item.source_revision_sequence, "source_revision_sequence");
    if (!contract.source_publication.revocations.reasons.includes(item.reason)) fail("validation_failed");
    timestamp(item.effective_at, "effective_at");
    boolean(item.restorable, "restorable");
  }
  requiredString(value.high_water, "high_water");
  nonblank(value.policy_revision, contract.common.policy_revision_maximum_bytes, "policy_revision");
  optionalNullableString(value.next_cursor, "next_cursor");
  boolean(value.complete, "complete");
  correlation(value.correlation_id, contract);
}

export function validateErrorResponse(value, contract, protectedValues = []) {
  exactObject(value, contract.error_responses.required_fields, [], "error response");
  if (bytes(JSON.stringify(value)) > contract.error_responses.maximum_json_bytes) fail("validation_failed", "error response exceeds maximum_json_bytes");
  correlation(value.correlation_id, contract);
  requiredString(value.message, "message");
  if (bytes(value.message) > contract.common.error_detail_maximum_bytes) fail("validation_failed");
  for (const protectedValue of protectedValues) if (protectedValue && value.message.includes(protectedValue)) fail("secret_exposure");
  if (!Object.values(contract.error_responses.statuses).flat().includes(value.error_code)) fail("validation_failed");
}

export function validateErrorResponseText(text, contract, protectedValues = []) {
  return validateBoundedJsonText(text, contract.error_responses.maximum_json_bytes, "error response", (value) => validateErrorResponse(value, contract, protectedValues));
}

export function validateNetwork(value, contract, localForumId) {
  exactObject(value, contract.discourse_network.required_provenance_fields, [], "network provenance");
  pattern(value.origin_forum_id, contract.discourse_network.forum_id_pattern);
  nonblank(value.origin_forum_name, contract.discourse_network.origin_forum_name_maximum_bytes, "origin_forum_name");
  httpUrl(value.origin_topic_url, contract.resolve.field_rules.canonical_url_maximum_bytes, "origin_topic_url");
  pattern(value.content_authority_forum_id, contract.discourse_network.forum_id_pattern);
  pattern(value.operation_id, contract.discourse_network.operation_id_pattern);
  if (!contract.discourse_network.relationships.includes(value.relationship)) fail("direction_denied");
  if (!contract.discourse_network.managed_scopes.includes(value.managed_scope)) fail("scope_denied");
  if (localForumId && value.origin_forum_id === localForumId) fail("direction_denied");
  if (!Array.isArray(value.route_forum_ids) || value.route_forum_ids.length > contract.discourse_network.route_maximum_forums || new Set(value.route_forum_ids).size !== value.route_forum_ids.length) fail("validation_failed");
  if (value.route_forum_ids.length === 0) fail("validation_failed");
  for (const forumId of value.route_forum_ids) pattern(forumId, contract.discourse_network.forum_id_pattern);
  if (localForumId && value.route_forum_ids.includes(localForumId)) fail("scope_denied");
}

export function validateNetworkRoute(value, contract) {
  exactObject(value, ["authenticated_sender_forum_id", "local_forum_id", "authorized_peer", "route_before", "route_after", "correlation_id"], [], "network route append");
  pattern(value.authenticated_sender_forum_id, contract.discourse_network.forum_id_pattern);
  pattern(value.local_forum_id, contract.discourse_network.forum_id_pattern);
  if (value.authorized_peer !== true) fail("direction_denied");
  if (!Array.isArray(value.route_before) || !Array.isArray(value.route_after) || value.route_before.length === 0) fail("validation_failed");
  for (const forumId of [...value.route_before, ...value.route_after]) pattern(forumId, contract.discourse_network.forum_id_pattern);
  if (new Set(value.route_before).size !== value.route_before.length || new Set(value.route_after).size !== value.route_after.length) fail("scope_denied");
  if (value.route_before.at(-1) !== value.authenticated_sender_forum_id) fail("direction_denied");
  if (value.route_before.includes(value.local_forum_id)) fail("scope_denied");
  if (canonicalize(value.route_after) !== canonicalize([...value.route_before, value.local_forum_id])) fail("validation_failed");
  if (value.route_after.length > contract.discourse_network.route_maximum_forums) fail("validation_failed");
  correlation(value.correlation_id, contract);
}

export function validateReplay(stored, replay) {
  for (const field of ["origin_forum_id", "operation_id", "source_revision", "content_sha256", "route_forum_ids", "relationship", "managed_scope", "policy_revision"]) {
    if (!Object.hasOwn(stored, field) && !Object.hasOwn(replay, field)) continue;
    if (!Object.hasOwn(stored, field) || !Object.hasOwn(replay, field)) fail("operation_replay_mismatch");
    if (canonicalize(stored[field]) !== canonicalize(replay[field])) fail("operation_replay_mismatch");
  }
}

export function validateForumClone(existingForumId, cloneForumId, rotatedAndReauthorized) {
  if (existingForumId === cloneForumId) fail("identity_conflict");
  if (rotatedAndReauthorized !== true) fail("identity_conflict");
}

export function validateOperatorEntitlement(entitlement, operator, trust, context = {}) {
  exactObject(entitlement, operator.entitlement.required_fields, [], "operator entitlement");
  if (entitlement.entitlement_version !== operator.entitlement.entitlement_version) fail("entitlement_invalid_signature");
  pattern(entitlement.entitlement_id, operator.entitlement.entitlement_id_pattern, "entitlement_invalid_signature");
  pattern(entitlement.provider_id, operator.entitlement.provider_id_pattern, "entitlement_invalid_signature");
  pattern(entitlement.forum_id, operator.entitlement.forum_id_pattern, "entitlement_invalid_signature");
  pattern(entitlement.issuer_id, operator.entitlement.issuer_id_pattern, "entitlement_invalid_signature");
  nonblank(entitlement.provider_name, operator.entitlement.provider_name_maximum_bytes, "provider_name");
  nonblank(entitlement.key_id, operator.entitlement.key_id_maximum_bytes, "key_id");
  if (!Array.isArray(entitlement.scopes)) fail("entitlement_invalid_signature");
  const signature = entitlement.signature;
  if (typeof signature !== "string") fail("entitlement_invalid_signature");
  const signatureBytes = Buffer.from(signature, "base64url");
  if (!base64urlPattern.test(signature) || signature.includes("=") || signatureBytes.length !== operator.entitlement.signature_decoded_bytes || signatureBytes.toString("base64url") !== signature) fail("entitlement_invalid_signature");
  const trustKey = trust?.[`${entitlement.issuer_id}:${entitlement.key_id}`];
  if (!trustKey || !base64urlPattern.test(trustKey)) fail("entitlement_invalid_signature");
  const raw = Buffer.from(trustKey, "base64url");
  if (raw.length !== 32 || raw.toString("base64url") !== trustKey) fail("entitlement_invalid_signature");
  const publicKey = createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), raw]), format: "der", type: "spki" });
  const unsigned = structuredClone(entitlement);
  delete unsigned.signature;
  const message = Buffer.from(`${operator.entitlement.signing_domain}${canonicalize(unsigned, "entitlement_invalid_signature")}`, "utf8");
  if (!verify(null, message, publicKey, signatureBytes)) fail("entitlement_invalid_signature");
  if (entitlement.scopes.length === 0) fail("scope_denied");
  for (const scope of entitlement.scopes) if (!operator.entitlement.allowed_scopes.includes(scope)) fail("scope_denied");
  for (const field of ["issued_at", "not_before", "expires_at", "grace_until"]) timestamp(entitlement[field], field);
  if (compareTimestamps(entitlement.not_before, entitlement.issued_at) < 0) fail("validation_failed");
  if (compareTimestamps(entitlement.expires_at, entitlement.not_before) <= 0 || compareTimestamps(entitlement.expires_at, addTimestampSeconds(entitlement.issued_at, operator.entitlement.maximum_lifetime_seconds, "issued_at"), "expires_at", "maximum entitlement expiry") > 0) fail("validation_failed");
  if (compareTimestamps(entitlement.grace_until, entitlement.expires_at) < 0 || compareTimestamps(entitlement.grace_until, addTimestampSeconds(entitlement.expires_at, operator.entitlement.maximum_grace_seconds, "expires_at"), "grace_until", "maximum grace expiry") > 0) fail("validation_failed");
  object(context, "operator execution context");
  if (Object.keys(context).length > 0) {
    exactObject(context, ["forumId", "at", "state", "scope", "mutation"], ["operationSha256", "proposalId", "customerApproval"], "operator execution context");
    pattern(context.forumId, operator.entitlement.forum_id_pattern, "scope_denied", "context.forumId");
    timestamp(context.at, "context.at");
    enumValue(context.state, operator.states, "context.state");
    enumValue(context.scope, operator.entitlement.allowed_scopes, "context.scope");
    boolean(context.mutation, "context.mutation");
    if (context.forumId !== entitlement.forum_id) fail("entitlement_wrong_forum");
    if (!entitlement.scopes.includes(context.scope)) fail("scope_denied");
    if (context.state === "revoked") fail("entitlement_revoked");
    if (context.state === "replaced") fail("entitlement_replaced");
    if (context.state === "pending_enrollment") fail("scope_denied");
    if (context.state === "expired") fail("entitlement_expired");
    if (compareTimestamps(context.at, entitlement.not_before, "context.at", "not_before") < 0) fail("entitlement_not_yet_valid");
    if (compareTimestamps(context.at, entitlement.grace_until, "context.at", "grace_until") > 0) fail("entitlement_expired");
    const observation = context.scope.startsWith("observe_");
    const preparation = context.scope.startsWith("prepare_");
    const requiresMutation = !observation && !preparation;
    if (context.mutation !== requiresMutation) fail("scope_denied");
    if (context.state === "grace_read_only" && !observation) fail("scope_denied");
    if (context.state === "active" && compareTimestamps(context.at, entitlement.expires_at, "context.at", "expires_at") > 0) fail("scope_denied");
    if (context.scope.startsWith("apply_customer_approved_")) {
      pattern(context.operationSha256, operator.audit.operation_sha256_pattern, "scope_denied", "context.operationSha256");
      requiredString(context.proposalId, "context.proposalId");
      exactObject(context.customerApproval, ["providerId", "forumId", "scope", "operationSha256", "proposalId", "expiresAt"], [], "customer approval");
      pattern(context.customerApproval.providerId, operator.entitlement.provider_id_pattern, "scope_denied", "approval.providerId");
      pattern(context.customerApproval.forumId, operator.entitlement.forum_id_pattern, "scope_denied", "approval.forumId");
      pattern(context.customerApproval.operationSha256, operator.audit.operation_sha256_pattern, "scope_denied", "approval.operationSha256");
      requiredString(context.customerApproval.proposalId, "approval.proposalId");
      timestamp(context.customerApproval.expiresAt, "approval.expiresAt");
      if (context.customerApproval.providerId !== entitlement.provider_id || context.customerApproval.forumId !== entitlement.forum_id || context.customerApproval.scope !== context.scope || context.customerApproval.operationSha256 !== context.operationSha256 || context.customerApproval.proposalId !== context.proposalId || compareTimestamps(context.customerApproval.expiresAt, context.at, "approval.expiresAt", "context.at") < 0) fail("scope_denied");
    }
  }
}

export function validateRevisionTransition(stored, incoming) {
  for (const field of ["external_id", "source_created_at"]) {
    if (Object.hasOwn(stored, field) && Object.hasOwn(incoming, field) && stored[field] !== incoming[field]) fail("identity_conflict");
  }
  if (incoming.source_revision_sequence < stored.source_revision_sequence) fail("revision_conflict");
  if (incoming.source_revision_sequence === stored.source_revision_sequence && (incoming.source_revision !== stored.source_revision || incoming.source_content_sha256 !== stored.source_content_sha256)) fail("reconciliation_required");
  if (incoming.source_revision_sequence > stored.source_revision_sequence && incoming.source_revision === stored.source_revision) fail("reconciliation_required");
}

export function validateDirection(connection, request) {
  if (!connection.directions.includes(request.direction)) fail("direction_denied");
}

export function validateScope(connection, request) {
  if (!connection.lanes.includes(request.lane)) fail("scope_denied");
}

export function validateLeaseTime(leaseExpiresAt, receivedAt) {
  if (compareTimestamps(receivedAt, leaseExpiresAt, "received_at", "lease_expires_at") > 0) fail("work_expired");
}

export function validateLeaseRenewal(current, requested, maximum) {
  nonnegativeInteger(current, "current_total_lease_seconds");
  positiveInteger(requested, "requested_lease_seconds");
  positiveInteger(maximum, "maximum_total_lease_seconds");
  if (current + requested > maximum) fail("lease_limit_exceeded");
}

export function validateCursorSnapshot(request, binding) {
  for (const field of ["snapshot", "connection_id", "policy_revision"]) {
    if (Object.hasOwn(binding, field) && request[field] !== binding[field]) fail("cursor_snapshot_mismatch");
  }
}

export function validateIdentity(stored, incoming) {
  if (stored.canonical_url === incoming.canonical_url && stored.external_id !== incoming.external_id) fail("identity_conflict");
}

export function validateAcknowledgementIdentity(work, acknowledgement, state = "leased", context = {}) {
  if (state === "superseded") fail("work_superseded");
  const expectedState = { synchronized: "leased", deployed: "awaiting_deployment", verified: "awaiting_verification" }[acknowledgement.stage];
  if (state !== expectedState) fail("stage_conflict", "acknowledgement is not legal for current work state");
  object(context, "acknowledgement acceptance context");
  if (Object.hasOwn(work, "lease_token") && work.lease_token !== acknowledgement.lease_token) fail("reconciliation_required");
  if (Object.hasOwn(work, "stage_token") && work.stage_token !== acknowledgement.stage_token) fail("stage_conflict");
  for (const field of ["resource_id", "destination_policy_id", "action"]) {
    if (Object.hasOwn(work, field) && work[field] !== acknowledgement[field]) fail("identity_conflict");
  }
  if (work.source_revision !== acknowledgement.source_revision || work.source_revision_sequence !== acknowledgement.source_revision_sequence || work.policy_revision !== acknowledgement.policy_revision) fail("revision_conflict");
  enumValue(context.destination_mode, ["dynamic", "static"], "destination_mode");
  if (acknowledgement.stage === "synchronized") {
    exactObject(context, ["received_at", "claimed_at", "destination_mode"], [], "acknowledgement acceptance context");
    const acknowledgementClaimsDynamic = acknowledgement.deployment_state === "not_required" && acknowledgement.verification_state === "not_required";
    if (context.destination_mode === "dynamic" && !acknowledgementClaimsDynamic) fail("stage_conflict", "dynamic destination requires terminal synchronized acknowledgement");
    if (context.destination_mode === "static" && acknowledgementClaimsDynamic) fail("stage_conflict", "static destination requires deployment and verification");
    timestamp(context.received_at, "received_at");
    timestamp(context.claimed_at, "claimed_at");
    validateLeaseTime(work.lease_expires_at, context.received_at);
    if (compareTimestamps(context.received_at, context.claimed_at, "received_at", "claimed_at") < 0 || compareTimestamps(acknowledgement.synchronized_at, context.claimed_at, "synchronized_at", "claimed_at") < 0) fail("validation_failed", "synchronization cannot precede claim issuance");
    if (compareTimestamps(acknowledgement.synchronized_at, context.received_at, "synchronized_at", "received_at") > 0) fail("validation_failed", "synchronization cannot occur after receipt");
  } else {
    exactObject(context, ["destination_mode"], ["received_at"], "acknowledgement acceptance context");
    if (context.destination_mode !== "static") fail("stage_conflict", "dynamic destination cannot advance beyond synchronization");
    if (Object.hasOwn(context, "received_at")) {
      timestamp(context.received_at, "received_at");
      const eventTime = acknowledgement.stage === "deployed" ? acknowledgement.deployed_at : acknowledgement.publicly_verified_at;
      if (compareTimestamps(eventTime, context.received_at, `${acknowledgement.stage}_at`, "received_at") > 0) fail("validation_failed", "publication event cannot occur after receipt");
    }
  }
}

export function validateUrlProof(value) {
  if (!value.transitions.length || value.transitions.at(-1).new_url !== value.to_url) fail("reconciliation_required");
  if (value.transitions[0].old_url !== value.from_url) fail("reconciliation_required");
  const visited = new Set([value.from_url]);
  for (const transition of value.transitions) {
    if (visited.has(transition.new_url)) fail("reconciliation_required");
    visited.add(transition.new_url);
  }
  for (let index = 1; index < value.transitions.length; index += 1) {
    if (value.transitions[index - 1].new_url !== value.transitions[index].old_url) fail("reconciliation_required");
  }
}

export function validateUrlProofResponse(value, contract) {
  exactObject(value, contract.records.source_url_migration_attestation.required_response_fields, [], "source URL proof");
  uuid(value.resource_id, contract, "resource_id");
  positiveInteger(value.topic_id, "topic_id");
  nonblank(value.external_id, contract.resolve.field_rules.external_id_maximum_bytes, "external_id");
  httpUrl(value.from_url, contract.resolve.field_rules.canonical_url_maximum_bytes, "from_url");
  httpUrl(value.to_url, contract.resolve.field_rules.canonical_url_maximum_bytes, "to_url");
  boolean(value.verified, "verified");
  if (value.verified !== true) fail("reconciliation_required");
  if (!Array.isArray(value.transitions) || value.transitions.length > contract.records.source_url_migration_attestation.maximum_transitions) fail("validation_failed");
  for (const transition of value.transitions) {
    exactObject(transition, contract.records.source_url_migration_attestation.transition_required_fields, [], "source URL transition");
    httpUrl(transition.old_url, contract.resolve.field_rules.canonical_url_maximum_bytes, "transition.old_url");
    httpUrl(transition.new_url, contract.resolve.field_rules.canonical_url_maximum_bytes, "transition.new_url");
    if (!contract.records.source_url_migration_attestation.permanent_redirect_statuses.includes(transition.redirect_status)) fail("reconciliation_required");
    timestamp(transition.verified_at, "transition.verified_at");
  }
  if (value.transition_count !== value.transitions.length) fail("validation_failed");
  timestamp(value.verified_at, "verified_at");
  correlation(value.correlation_id, contract);
  validateUrlProof(value);
}

export function validateOperatorAudit(value, operator) {
  exactObject(value, operator.audit.required_fields, [], "operator audit");
  pattern(value.event_id, operator.audit.event_id_pattern);
  pattern(value.operation_sha256, operator.audit.operation_sha256_pattern);
  pattern(value.forum_id, operator.entitlement.forum_id_pattern);
  pattern(value.provider_id, operator.entitlement.provider_id_pattern);
  pattern(value.entitlement_id, operator.entitlement.entitlement_id_pattern);
  timestamp(value.occurred_at, "occurred_at");
  for (const field of ["forum_id", "provider_id", "entitlement_id", "actor", "scope", "action", "target_type", "target_id", "customer_approval_id"]) requiredString(value[field], field);
  if (!operator.audit.outcomes.includes(value.outcome)) fail("validation_failed");
}

export function validateDestinationCollision(value) {
  if (value.to_url === value.existing_binding.canonical_url && value.moving_resource_id !== value.existing_binding.resource_id) fail("destination_collision");
}

export function validateRetiredUrl(value) {
  if (value.to_url === value.retired_binding.canonical_url && value.retired_binding.state === "retired" && value.moving_resource_id !== value.retired_binding.resource_id) fail("url_retired");
}

export function validateContractHeader(headers, contract) {
  if (headers[contract.authentication.contract_header] !== contract.authentication.contract_header_value) fail("validation_failed");
}

export function validateRepositoryIdentity(packageMetadata, contract, operator) {
  if (packageMetadata.name !== "discussionbridge-adapter-contract" || packageMetadata.private !== true || packageMetadata.scripts?.test !== "node tests/validate-contract.mjs") fail("validation_failed", "package metadata is invalid");
  for (const version of [packageMetadata.version, contract.version, contract.authentication.contract_header_value, operator.version]) {
    if (version !== contract.version) fail("contract_version_mismatch", "authoritative contract identities disagree");
  }
}

export function validateEntitlementTime(value) {
  if (compareTimestamps(value.request_at, value.entitlement.grace_until, "request_at", "grace_until") > 0) fail("entitlement_expired");
}

export function validateCutoverManifest(value, contract) {
  exactObject(value, ["manifest_id", "adapter_protocol", "shared_plugin", "adapters", "receiver_schema", "configuration_revision", "policy_revisions", "consumer_identities", "correlation_id"], [], "cutover manifest");
  exactObject(value.adapter_protocol, ["version", "sha256"], [], "adapter protocol artifact");
  exactObject(value.shared_plugin, ["version", "sha256"], [], "shared plugin artifact");
  requiredString(value.manifest_id, "manifest_id");
  requiredString(value.adapter_protocol.version, "adapter protocol version");
  requiredString(value.shared_plugin.version, "shared plugin version");
  requiredString(value.receiver_schema, "receiver_schema");
  requiredString(value.configuration_revision, "configuration_revision");
  uniqueStrings(value.policy_revisions, "policy_revisions");
  uniqueStrings(value.consumer_identities, "consumer_identities");
  if (!Array.isArray(value.adapters) || value.adapters.length === 0) fail("validation_failed");
  const profiles = new Set();
  for (const adapter of value.adapters) {
    exactObject(adapter, ["profile", "version", "sha256"], [], "adapter artifact");
    enumValue(adapter.profile, contract.profiles, "adapter profile");
    if (profiles.has(adapter.profile)) fail("validation_failed", "duplicate adapter profile");
    profiles.add(adapter.profile);
    requiredString(adapter.version, "adapter version");
  }
  for (const artifact of [value.adapter_protocol, value.shared_plugin, ...value.adapters]) pattern(artifact.sha256, contract.common.sha256_pattern);
  if (value.adapter_protocol.version !== contract.version) fail("validation_failed");
  correlation(value.correlation_id, contract);
}

export function validateCutoverRehearsal(value, manifest, contract) {
  exactObject(value, ["manifest_id", "manifest_sha256", "preflight", "mismatch_rejected_before_mutation", "one_item_canary", "ten_item_canary", "rollback_boundary", "correlation_id"], [], "cutover rehearsal");
  if (value.manifest_id !== manifest.manifest_id) fail("reconciliation_required", "cutover rehearsal manifest mismatch");
  pattern(value.manifest_sha256, contract.common.sha256_pattern, "validation_failed", "manifest_sha256");
  if (value.manifest_sha256 !== sha256(canonicalize(manifest))) fail("reconciliation_required", "cutover rehearsal artifact mismatch");
  for (const field of ["preflight", "one_item_canary", "ten_item_canary"]) if (value[field] !== "passed") fail("validation_failed");
  if (value.mismatch_rejected_before_mutation !== true) fail("validation_failed");
  requiredString(value.rollback_boundary, "rollback_boundary");
  correlation(value.correlation_id, contract);
}

export function validateRetryTrace(value, contract) {
  if (value.initial_attempt !== contract.publication_work.initial_attempts) fail("validation_failed");
  if (!Array.isArray(value.failures) || value.failures.length !== contract.publication_work.maximum_total_attempts) fail("validation_failed");
  for (let index = 0; index < value.failures.length; index += 1) {
    const failure = value.failures[index];
    exactObject(failure, ["attempt_count", "backoff_seconds", "resulting_state"], [], "retry failure");
    if (failure.attempt_count !== index + 1) fail("validation_failed");
    const final = index === value.failures.length - 1;
    if (failure.backoff_seconds !== (final ? null : contract.publication_work.retry_backoff_seconds[index])) fail("validation_failed");
    if (failure.resulting_state !== (final ? "operator_attention" : "retry_wait")) fail("validation_failed");
  }
  exactObject(value.successful_retry, ["attempt_count", "resulting_state"], [], "successful retry");
  if (!Number.isSafeInteger(value.successful_retry.attempt_count) || value.successful_retry.attempt_count < 1 || value.successful_retry.attempt_count > contract.publication_work.maximum_total_attempts || value.successful_retry.resulting_state !== "acknowledged") fail("validation_failed");
  exactObject(value.terminal_failure, ["attempt_count", "resulting_state"], [], "terminal failure");
  if (!Number.isSafeInteger(value.terminal_failure.attempt_count) || value.terminal_failure.attempt_count < 1 || value.terminal_failure.attempt_count > contract.publication_work.maximum_total_attempts) fail("validation_failed");
  if (value.terminal_failure.resulting_state !== "operator_attention") fail("validation_failed");
  exactObject(value.manual_retry, ["customer_authorized", "condition_corrected", "same_work_id", "from_retry_generation", "to_retry_generation", "reentry_state", "next_attempt_count"], [], "manual retry");
  if (value.manual_retry.customer_authorized !== true || value.manual_retry.condition_corrected !== true || value.manual_retry.same_work_id !== true) fail("validation_failed");
  nonnegativeInteger(value.manual_retry.from_retry_generation, "from_retry_generation");
  nonnegativeInteger(value.manual_retry.to_retry_generation, "to_retry_generation");
  if (value.manual_retry.to_retry_generation !== value.manual_retry.from_retry_generation + 1 || value.manual_retry.reentry_state !== "available" || value.manual_retry.next_attempt_count !== contract.publication_work.initial_attempts) fail("validation_failed");
  correlation(value.correlation_id, contract);
}
