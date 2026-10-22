# Agentic-PhysicianAssist

This repository hosts the deployment infrastructure and synced assets for the demo.

It belongs to a demo available on [go/demos](http://goto.google.com/demos). The repository title follows the syntax `{demo_id}-{slugified_demo_title}`.

**ℹ️ Empty Directories:** Some directories in this repository might initially be empty. This happens if the demo does not yet include GitHub artifacts. The repository is provisioned automatically with these folders so you have a place to start adding click-to-deploy code or other demo-related code.

## Quick Start Guidelines

To ensure your contributions are preserved and automated syncs run smoothly, please use the appropriate directory below:

- **✅ Develop Click-to-Deploy Assets here:** `/click-to-deploy` **Active Workspace:** Use this directory to actively develop, update, and manage the demo's deployment scripts and click-to-deploy configurations. All pull requests for deployment capabilities should target this folder.
- **✅ Contribute Skills here:** `/skills` **Active Workspace:** This folder contains auto-generated skills available for the demo, but users are free to contribute additional skills.
- **✅ Add and modify other folders:** You are free to add and modify additional folders.
- **🚫 DO NOT modify this directory:** `/demo` **Automated Sync:** This directory is periodically overwritten by an automated sync from the upstream source repositories. These syncs are used for the versioning feature ([read more](http://go/demo-versioning)). Any manual changes made directly in this folder will be permanently lost on the next sync.
