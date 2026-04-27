---
name: hello-command
description: A sample command to demonstrate structure and environment variables.
parameters:
  - name: name
    description: Name to greet
    required: true
example: ">hello-command MyName"
---

# Hello World Command
This is a demonstration command for Citron IDE. It shows how to:
1. Use an entry point (`run.sh`).
2. Use support scripts (`scripts/hello.py`).
3. Read environment variables provided by the IDE.
