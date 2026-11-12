# DiscussionBridge Adapter Protocol

This repository defines how DiscussionBridge for Discourse and platform
integrations exchange publication and discussion information. Use it when
building or maintaining an integration.

- [Routes](ROUTES.md) describes the requests available to an integration.
- [Contract](normative/CONTRACT.json) defines the request and response formats.
- [PHP guide](src/php/README.md) explains how to use the generated PHP codec.

The V4 Alpha projects use [R7](https://github.com/DiscussionBridge/discussionbridge-adapter-contract/tree/09d77c0209835c2d996aad294d161f167c7bd838), which defines 36 Content Connection
routes. See [Versions and Live Status](https://docs.discussionbridge.dev/versions-and-live-status/) for the matching component
source tags.
