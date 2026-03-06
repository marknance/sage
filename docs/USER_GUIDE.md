# Sage User Guide

Welcome to Sage — your personal AI expert studio. This guide walks you through everything you need to know as a user.

---

## Table of Contents

- [Getting Started](#getting-started)
- [AI Backends](#ai-backends)
- [Experts](#experts)
- [Conversations](#conversations)
- [Settings](#settings)
- [Keyboard Shortcuts](#keyboard-shortcuts)

---

## Getting Started

### First Login

When Sage starts for the first time, it creates an admin account and prints the credentials to the server log:

```
[SAGE SETUP] Admin credentials: admin@sage.local / <random-password>
[SAGE SETUP] You must change this password on first login.
```

If running via Docker, view the credentials with:

```bash
docker compose logs sage | grep "SAGE SETUP"
```

If running locally, look in the terminal where the server started.

Log in with the generated email and password. You will be prompted to change your password immediately.

### Navigation Overview

Sage has five main sections accessible from the sidebar:

| Section | Description |
|---------|-------------|
| **Conversations** | Chat with your AI experts |
| **Experts** | Create and manage specialized AI agents |
| **Backends** | Configure AI providers (Ollama, OpenAI, etc.) |
| **Categories** | Organize experts into groups |
| **Settings** | Profile, defaults, usage stats, and admin tools |

### Recommended Setup Order

1. **Add a backend** — Connect at least one AI provider
2. **Create an expert** — Build your first specialized AI agent
3. **Start a conversation** — Put your expert to work

---

## AI Backends

Backends are the AI providers that power your experts. Sage supports:

- **Ollama** — Free, local AI models (default: `http://localhost:11434`)
- **OpenAI** — GPT models via API key (`https://api.openai.com`)
- **Anthropic** — Claude models via API key (`https://api.anthropic.com`)
- **LMStudio** — Local models via LMStudio (default: `http://localhost:1234`)
- **Custom** — Any OpenAI-compatible API endpoint

### Adding a Backend

1. Go to **Backends** in the sidebar
2. Click **New Backend**
3. Fill in the details:
   - **Name** — A friendly name (e.g., "My Ollama", "OpenAI Production")
   - **Type** — Select your provider; the base URL auto-fills
   - **Base URL** — Adjust if your provider runs on a different host/port
   - **API Key** — Required for OpenAI and Anthropic; stored encrypted
   - **Organization ID** — OpenAI only, if applicable
4. Click **Create Backend**

### Testing a Connection

After creating a backend, click **Test Connection** on the edit page. Sage will attempt to fetch the model list from the provider. A successful test shows how many models were found.

### Fetching Models

When you select a backend anywhere in Sage (expert creation, conversation settings), it automatically fetches available models from that backend. These appear as dropdowns so you can pick the exact model you want.

---

## Experts

Experts are specialized AI agents configured with a specific domain, personality, and behavior set. Think of them as purpose-built assistants.

### Creating an Expert

Go to **Experts** and click **New Expert**.

**Step 1 — Basic Info**
- **Name** — Give your expert a name (e.g., "Python Mentor")
- **Domain** — What area does this expert cover? (e.g., "Python programming and best practices")
- **Description** — Optional longer description

**Step 2 — Personality**
- **Tone** — Choose from formal, casual, technical, friendly, or concise
- **System Prompt** — The instructions that shape how the expert responds. This is the most important field for customizing behavior.

**Step 3 — Behaviors**
Toggle specific behaviors on or off:
- Cite Sources
- Ask Clarifying Questions
- Provide Examples
- Use Analogies
- Summarize Responses

**Step 4 — Advanced**
- **AI Backend** — Which provider powers this expert
- **Model Override** — Use a specific model instead of the backend default
- **Memory Enabled** — Let the expert remember facts from conversations

### Using Templates

Sage includes 8 built-in templates to get you started quickly:

- Code Reviewer
- Writing Coach
- Data Analyst
- Research Assistant
- Language Tutor
- Math Tutor
- DevOps Engineer
- Creative Writer

Click a template to pre-fill all fields, then customize as needed.

### AI-Assisted Creation

- **Generate with AI** — Enter a domain and click "Generate with AI" to have the system fill in name, description, personality, and system prompt automatically
- **AI Assist** — Refine existing fields using AI suggestions (look for the wand icon)

### Expert Categories

Organize experts into categories for easy filtering:

- Go to **Categories** in the sidebar to create categories
- On an expert's detail page, assign it to one or more categories
- Use the **Suggest Categories** button to get AI-powered category suggestions based on the expert's domain

### Expert Memory

When memory is enabled, an expert automatically extracts and remembers key facts, preferences, and instructions from conversations. You can also:

- **Add memories manually** — On the expert's detail page, click "Add Memory" and choose a type (fact, preference, instruction, or context)
- **View all memories** — See everything the expert has learned
- **Delete individual memories** — Remove specific items
- **Clear all memories** — Start fresh

### Import & Export

- **Export** — On an expert's detail page, click **Export** to download a JSON file containing the expert's configuration, behaviors, categories, and memories
- **Import** — On the Experts list page, click **Import** and upload a JSON file. Choose a conflict strategy:
  - **Skip** — Don't import if an expert with the same name exists
  - **Rename** — Import with a modified name
  - **Overwrite** — Replace the existing expert

### Cloning

Click **Clone** on any expert's detail page to create an identical copy. The clone gets a new name (e.g., "Python Mentor (Copy)") and can be customized independently.

---

## Conversations

Conversations are where you interact with your experts.

### Starting a Conversation

1. Go to **Conversations** and click **New Conversation**
2. Choose a conversation type:
   - **Standard** — General-purpose chat
   - **Research** — Optimized for research tasks
   - **Brainstorm** — Creative ideation mode
   - **Debug** — Technical debugging sessions
3. A new conversation opens with your default expert assigned

### Chatting

- Type your message and press **Enter** to send
- Press **Shift+Enter** for a new line
- Messages stream in real-time as the AI responds

### Message Actions

Hover over any message to see available actions:

- **Copy** — Copy message content to clipboard
- **Edit** (your messages only) — Modify what you sent
- **Retry** (AI messages) — Re-generate the response
- **Fork** (AI messages) — Branch the conversation from that point
- **Delete** — Remove the message

### Document Uploads

Upload documents for the AI to reference during your conversation:

1. Open the sidebar panel (toggle button in the top bar)
2. Scroll to the **Documents** section
3. Drag and drop files or click to browse
4. Supported formats: `.txt`, `.md`, `.csv`, `.json`, `.xml`, `.html`, `.log`, `.pdf`, `.docx`
5. Maximum file size: 10 MB

Uploaded documents are automatically extracted and included as context for the AI.

### Multi-Expert Conversations

Assign multiple experts to a single conversation:

1. Open the sidebar panel
2. In the **Experts** section, use the dropdown to assign additional experts
3. Use `@name` in your message to direct it to a specific expert
4. Each expert can have its own backend and model override for the conversation

### Debate Mode

When multiple experts are assigned, enable **Debate Mode** in the sidebar settings. In this mode, every assigned expert responds to each message in sequence, and each can see what the previous expert said.

### Auto-Suggest

Enable **Auto-Suggest** in the sidebar to have Sage recommend relevant experts based on your message content. Suggested experts appear as buttons you can click to assign.

### Tags

Organize conversations with colored tags:

- Create tags from the conversations list filter panel
- Add tags to conversations for easy filtering
- Filter the conversations list by tag

### Pinning

Pin important conversations to keep them at the top of your list. Click the pin icon on any conversation card, or use the "Pinned only" filter.

### Search

- **Conversations list** — Search by title or message content using the search bar
- **Within a conversation** — Press **Ctrl+F** (or **Cmd+F**) to search through messages in the current conversation. Use **Enter** for next match and **Shift+Enter** for previous.

### Exporting

Export any conversation from the top bar menu:

- **JSON** — Full structured export with metadata
- **Markdown** — Human-readable format

### Bulk Actions

On the conversations list, click **Select** to enter multi-select mode. Select conversations and click **Delete Selected** to remove them in bulk.

---

## Settings

Access settings from the sidebar or navigate to `/settings`.

### Profile

- **Username** — Change your display name
- **Email** — Update your email address
- **Password** — Change your password (requires current password, minimum 8 characters)
- **Delete Account** — Permanently delete your account and all data (requires password confirmation)

### Defaults

Set your preferred defaults for new conversations:

- **Default Backend** — Which AI provider to use by default
- **Default Model** — Which model to use by default
- **Default Conversation Type** — Standard, Research, Brainstorm, or Debug

### Usage

View your token usage over the last 30 days:

- Total messages sent
- Prompt tokens consumed
- Completion tokens generated
- Daily usage bar chart

### Theme

Cycle through three themes using the toggle in the top navigation bar:

- **Dark** — Dark background with light text
- **Light** — Light background with dark text
- **Thunder Light** — Alternative light theme

### Admin Panel (Admin Users Only)

Admin users see additional tabs in Settings:

**Users**
- View all registered users
- Search by name or email
- Change user roles (user/admin)
- Reset user passwords (generates a temporary password)
- Delete users

**Content**
- Browse all conversations and experts across all users
- Search and paginate through content
- Delete conversations or experts from any user

**Stats**
- System-wide counts: users, conversations, messages, experts, backends
- Database file size

---

## Keyboard Shortcuts

### Global

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` / `Cmd+K` | Go to Conversations and focus search |
| `Ctrl+Shift+C` / `Cmd+Shift+C` | Go to Conversations |
| `Ctrl+Shift+E` / `Cmd+Shift+E` | Go to Experts |
| `Ctrl+Shift+N` / `Cmd+Shift+N` | Create New Expert |
| `Escape` | Close any open modal |

### In a Conversation

| Shortcut | Action |
|----------|--------|
| `Enter` | Send message |
| `Shift+Enter` | New line |
| `Ctrl+F` / `Cmd+F` | Search messages |
| `@name` | Mention a specific expert |
| `Escape` | Close search or autocomplete |

### In Message Search

| Shortcut | Action |
|----------|--------|
| `Enter` | Next match |
| `Shift+Enter` | Previous match |
| `Escape` | Close search |
