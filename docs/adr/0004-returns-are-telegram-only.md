# Returns happen only through the Telegram bot

Equipment may be picked up (started) from either the web app or the Telegram bot,
but returns are exposed only through the bot — there is deliberately no web return
endpoint. A return requires a verifiable photo of the equipment, and the bot is
where members and the audit channel already live; a web path would duplicate that
flow and its verification. The web UI's return affordances point at the bot
instead.
