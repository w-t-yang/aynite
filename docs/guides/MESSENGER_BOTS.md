# Messenger Bots Guide

Aynite supports connecting messenger bots (Telegram and Discord) that let you chat
with your AI agent from anywhere. The bot can work on tasks, answer questions,
and manage sessions — all through your messenger app.

---

## 1. Telegram Bot

### 1.1 Create a Telegram Bot

1. Open Telegram and search for [**@BotFather**](https://t.me/botfather)
2. Start a chat and send `/newbot`
3. Follow the prompts:
   - Choose a **name** for your bot (e.g. `My Aynite Bot`)
   - Choose a **username** ending in `bot` (e.g. `my_aynite_bot`)
4. BotFather will reply with a **token** that looks like:
   ```
   123456789:ABCdefGHIjklMNOpqrsTUVwxyz
   ```
5. **Save this token** — you'll need it in Aynite.

### 1.2 Configure in Aynite

1. Go to **Settings → Messengers**
2. Click **Add Bot**
3. Set the **Provider** to **Telegram**
4. Paste the token from BotFather into the **API Key** field
5. Add **Trusted Users** (Telegram user IDs or @usernames):
   - To find your user ID, message [@userinfobot](https://t.me/userinfobot) on Telegram
   - Add entries like `123456789` or `@yourusername`
6. Toggle **Enabled** to **On**

> **Note**: If the whitelist is empty, **no one** can talk to the bot. You must
> add at least one user.

### 1.3 Test the Bot

1. Open Telegram and find your bot by its username
2. Start a chat and send `?` — the bot should reply with workspace info
3. Send a message like `list files in my project` — the bot will run the AI agent
   and reply with the result

### 1.4 Bot Commands

| Command | Description |
|---------|-------------|
| `?` | Show workspace info, active session, folders |
| `/summarize` | Summarize the active session |
| `/new-session` | Create a new empty session |
| `/list-sessions` | List last 10 sessions |
| `/switch-session <index>` | Switch to a session by index |

Any other text is sent to the AI agent and processed as a task.

### 1.5 Group Chats

Your bot can also work in group chats:
1. Add the bot to a Telegram group
2. Mention the bot by @username (e.g. `@my_aynite_bot what's the weather?`)
3. The bot will only respond when explicitly mentioned
4. Recent messages before the mention are included as context for the AI

---

## 2. Discord Bot

### 2.1 Create a Discord Bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** and give it a name (e.g. `Aynite Bot`)
3. Go to the **Bot** tab in the left sidebar
4. Click **Add Bot** → **Yes, do it!**

### 2.2 Configure Bot Settings

In the **Bot** tab, configure the following:

**Privileged Gateway Intents** (enable these):
- ✅ **Message Content Intent** — Required to read what users say in server
  channels and DMs. Without this, `message.content` will be empty strings.

**Authorization Flow**:
- ✅ **Allow Direct Messages** — Required for the bot to receive DMs. This is
  **separate from the intents** — it's a toggle further up in the Bot settings.
  Without this, the bot will respond in server channels but never in DMs.

### 2.3 Get the Bot Token

Still in the **Bot** tab:
1. Under **Token**, click **Reset Token** (or copy the existing one)
2. Copy the token — it looks like:
   ```
   MTE4NzI5MzI4NzI5MzI4NzI5.GABCDE.f1LEks...
   ```

### 2.4 Invite the Bot to Your Server

1. Go to the **OAuth2 → URL Generator** tab
2. Under **Scopes**, check:
   - `bot`
   - `applications.commands`
3. Under **Bot Permissions**, check:
   - ✅ **Read Messages** (View Channels)
   - ✅ **Send Messages**
   - ✅ **Read Message History**
   - ✅ **Mention Everyone** (optional — so your bot can @mention users in replies)
4. Copy the generated URL at the bottom and open it in your browser
5. Select your server and click **Authorize**

> After inviting, the bot will appear in your server's member list.

### 2.5 Configure in Aynite

1. Go to **Settings → Messengers**
2. Click **Add Bot**
3. Set the **Provider** to **Discord**
4. Paste the bot token from the Developer Portal into the **API Key** field
5. Add **Trusted Users** (Discord user IDs):
   - To find your user ID: open Discord → Settings → Advanced → Enable
     **Developer Mode**. Then right-click your name in any chat → **Copy ID**
   - Add entries like `123456789012345678` or `@username`
6. Toggle **Enabled** to **On**

> **Note**: If the whitelist is empty, **no one** can talk to the bot. You must
> add at least one user.

### 2.6 Test the Bot

1. Open Discord and DM your bot
2. Send `?` — the bot should reply with workspace info
3. Send a message like `list files in my project`

### 2.7 Group Chat (Server Channels)

The Discord bot works the same way as the Telegram bot in group chats:
1. Make sure the bot has permission to read and send messages in the channel
2. @mention the bot (e.g. `@Aynite Bot what's the weather?`)
3. The bot will only respond when mentioned
4. Recent messages are included as context

### 2.8 Bot Commands

Same commands as Telegram (see [1.4 Bot Commands](#14-bot-commands) above).

---

## 3. Troubleshooting

### 3.1 "Sorry, I'm not allowed to talk to you."
- The whitelist is empty or doesn't include your user ID
- Add your Telegram user ID / @username or Discord user ID to the Trusted Users
  field in Settings → Messengers

### 3.2 Telegram: "404: Not Found"
- The bot token is invalid or the bot was deleted
- Create a new bot with BotFather and update the API key in Aynite

### 3.3 Discord: "Used disallowed intents"
- You haven't enabled **Message Content Intent** in the Discord Developer Portal
- Go to your bot application → **Bot** → **Privileged Gateway Intents** →
  enable **Message Content Intent**, then save and restart the bot

### 3.4 Discord: Bot responds in server channels but not in DMs
- Go to **Discord Developer Portal → Your Bot → Bot tab**
- Make sure **"Allow Direct Messages"** is enabled (it's a toggle in the
  **Authorization Flow** section, separate from intents)
- The bot and you must share at least one mutual server for DMs to work

### 3.5 Discord: Bot is online but doesn't respond at all
- Make sure the bot has **Send Messages** and **Read Message History** permissions
  in the channel
- For server channels, make sure you're @mentioning the bot
- Check that the bot has been invited with the correct permissions (see
  [2.4 Invite the Bot](#24-invite-the-bot-to-your-server))

### 3.5 Bot won't start after changing settings
- Toggle the bot off and on again in Settings → Messengers
- Or restart Aynite

### 3.6 "No active AI provider configured"
- Make sure you have at least one AI provider configured in Settings → AI
- The bot uses the same AI provider as the Aynite Chat

---

## 4. How It Works

Both messengers use the same underlying architecture:

```
Telegram/Discord → Aynite Messenger Runtime → AI Agent Loop → Tools (read/write files, etc.)
```

- Messages are processed by the same agent loop used in Aynite's AI Chat
- Each bot has its own session (separate from the desktop AI Chat session)
- Tools run with auto-approval (no confirmation prompts)
- The active workspace's folders and settings are used
