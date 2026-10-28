# skills

Agent skills for Claude Code, Codex, Cursor and any other agent that reads `SKILL.md`. Each one packages a workflow I've used for real work, with scripts that check the result.

[![Validate](https://github.com/mys1erious/skills/actions/workflows/validate.yml/badge.svg)](https://github.com/mys1erious/skills/actions/workflows/validate.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

```bash
npx skills add mys1erious/skills
```

## Skills

| Skill | What it does | Use when |
|---|---|---|
| [ascii-art](skills/ascii-art) | Builds ASCII art that looks designed: animated and interactive canvas pieces, image, logo and text to ASCII, plain-text art, and loopable videos for X. Tests what it builds in headless Chrome. | You want ASCII art or animation, a text-mode or terminal look, an image or logo turned into ASCII, or an ASCII piece to post. |
| [explainer-video](skills/explainer-video) | Makes short narrated explainer videos drawn in code, where the picture shows what the voice teaches with real data. Script, AI voice with word timings, frame-exact render, music and sound mix. | You want a TikTok, Reels, Shorts or YouTube video that teaches something, a narrated data story, or one script in several styles to compare. |

Each skill's page has a demo made by a fresh agent with only that skill, example requests, what's inside, requirements and what it sends where.

## Install

<details>
<summary><b>Any agent, with the skills CLI</b></summary>

```bash
npx skills add mys1erious/skills                                   # choose skills and agents
npx skills add mys1erious/skills --list                            # see what's here
npx skills add mys1erious/skills --skill ascii-art -a claude-code -g -y
```

Run `npx skills update` to update.
</details>

<details>
<summary><b>Claude Code plugin</b></summary>

```
/plugin marketplace add mys1erious/skills
/plugin install ascii-art@mys1erious
/plugin install explainer-video@mys1erious
```

Run `/plugin marketplace update mys1erious` to update.
</details>

<details>
<summary><b>Manual copy</b></summary>

Copy a skill's folder, e.g. `skills/ascii-art/`, into your agent's skills folder:

| Agent | Your user | One project |
|---|---|---|
| Claude Code | `~/.claude/skills/` | `.claude/skills/` |
| Codex | `~/.agents/skills/` | `.agents/skills/` |
| Cursor | `~/.cursor/skills/` | `.cursor/skills/` |

</details>

## Checks

Every pull request:
- validates each skill against the [Agent Skills spec](https://agentskills.io/specification);
- validates the Claude Code marketplace;
- renders the ascii-art starter and the explainer-video starter in headless Chrome, and fails on any page error.

## License

[MIT](LICENSE)
