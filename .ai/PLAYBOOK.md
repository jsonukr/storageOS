# StorageOS AI Development Playbook
Version: 1.0
Status: ACTIVE
Owner: Dhananjay Kumar Gupta
Tech Lead: ChatGPT
Last Updated: 30 June 2026

---

# Purpose

This document defines the permanent development workflow for StorageOS.

Everyone working on the project (human or AI) must follow this document.

This workflow is frozen unless explicitly changed by the Product Owner and Tech Lead.

---

# Project Vision

StorageOS is a unified storage management platform that allows users to connect, browse, search, transfer and manage files across local devices, cloud providers and network storage through one modern desktop application.

---

# Project Goals

Version 1 (MVP)

✔ Windows Desktop

✔ Local Drives

✔ Google Drive

✔ OneDrive

✔ SharePoint

✔ Dropbox

✔ Explorer

✔ Search

✔ Copy

✔ Move

✔ Delete

✔ Rename

✔ Upload

✔ Download

✔ Background Transfers

Future versions may include AI, plugins, NAS, Linux, macOS and mobile support.

---

# Team Roles

## Product Owner

Dhananjay Kumar Gupta

Responsibilities

- Product decisions
- Feature approval
- Testing
- GitHub ownership
- Final release approval

---

## Technical Lead

ChatGPT

Responsibilities

- Architecture
- Sprint Planning
- Task Planning
- Database Design
- API Design
- Documentation
- Code Review
- Technical Decisions

Only ChatGPT may approve architecture changes.

---

## Software Engineer

Claude Code

Responsibilities

- Implement tasks
- Refactor code
- Create tests
- Update documentation
- Self review

Claude must not change architecture.

---

## UI Designer

Figma

Responsibilities

- Design System
- Components
- Layouts
- Screens

Figma is the design source.

Claude implements designs.

---

# Source of Truth

Everything lives inside the GitHub repository.

Nothing should exist only inside chat.

---

# Folder Structure

StorageOS/

    .ai/

    docs/

    apps/

    services/

    connectors/

    shared/

    infrastructure/

    tests/

Do not change this structure without approval.

---

# Technology Stack

Desktop

- Tauri v2
- React
- TypeScript
- Vite
- Tailwind CSS
- Zustand
- TanStack Query
- React Router

Backend (Future)

- ASP.NET Core

Database

- SQLite

Cloud APIs

- Google Drive API

- Microsoft Graph API

- Dropbox API

---

# Architecture Rules

Use

- SOLID

- Clean Architecture

- Dependency Injection

- Feature based organization

Never tightly couple modules.

Everything communicates through interfaces.

---

# Connector Architecture

Every storage provider must implement a common connector interface.

Examples

Local

Google Drive

OneDrive

SharePoint

Dropbox

Future providers must require zero Explorer changes.

---

# Development Workflow

Sprint

↓

Task

↓

ChatGPT creates task

↓

Claude implements

↓

Claude self review

↓

Product Owner tests

↓

ChatGPT review

↓

Git Commit

↓

Next Task

No task starts before the previous one is approved.

---

# Task Rules

Every task contains

Task ID

Title

Objective

Acceptance Criteria

Dependencies

Claude Prompt

Review Checklist

Commit Message

---

# Claude Rules

Before every task Claude must read

.ai/CLAUDE.md

.ai/PROJECT_STATE.md

docs/

Claude MUST NOT

- Change architecture

- Add frameworks

- Add unnecessary dependencies

- Rename project structure

- Skip self review

If architecture changes are required Claude must stop and ask.

---

# Self Review

Every completed task must include

Completed

Files Changed

Known Limitations

Potential Risks

Suggested Improvements

---

# Code Standards

Strict TypeScript

Reusable Components

No duplicated logic

Meaningful names

No hardcoded values

No unused imports

No commented dead code

No console.log in production

---

# Git Workflow

Branches

main

develop

feature/task-xxx

bugfix/task-xxx

Commit Format

feat(module): description

fix(module): description

refactor(module): description

docs(module): description

---

# Documentation Rules

Every completed feature updates

PROJECT_STATE.md

CHANGELOG.md

Relevant documentation

---

# Design Rules

Desktop first

Modern

Professional

Minimal

Windows inspired

Consistent spacing

8 point spacing system

Reusable components

Dark and Light themes

---

# Review Rules

ChatGPT reviews every task before merge.

Nothing is merged without review.

---

# Definition of Done

The task is complete only when

✓ Acceptance criteria satisfied

✓ Builds successfully

✓ No TypeScript errors

✓ No lint errors

✓ Self review completed

✓ Documentation updated

✓ Product Owner tested

✓ ChatGPT approved

---

# AI Communication Rules

ChatGPT

Creates architecture

Creates tasks

Reviews implementation

Claude

Implements

Refactors

Updates docs

Self reviews

Figma

Creates and maintains design system

Provides UI reference

---

# Change Control

This document is frozen.

Any changes require approval from

Product Owner

AND

Tech Lead

---

# Project Principle

Build StorageOS like a commercial software product.

Quality is always more important than speed.

Every commit should be something we are proud to showcase.


## Domain Language Rule

All new models must be provider-agnostic.

Avoid names that are tied to a single platform or storage technology.

Prefer:

StorageEntry

StorageRoot

StorageProvider

StorageDevice

StorageLocation

Instead of:

Drive

Directory

WindowsDrive

LocalFolder

NTFSFile

ExplorerItem

The domain model is the single source of truth.

UI models may adapt domain models for presentation but must not redefine the domain language.