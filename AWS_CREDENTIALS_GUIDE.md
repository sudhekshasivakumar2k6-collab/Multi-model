# 🔑 AWS Credentials Configuration Guide

This document explains **where and how to replace your AWS credentials** in the Multi-Modal Assistant project.

---

## 📁 Primary File to Edit

```
multi-modal-assistant/
└── backend/
    └── .env          ← ✅ THIS IS THE ONLY FILE YOU NEED TO EDIT
```

### File path (absolute)
```
d:\project\multi-modal-assistant\backend\.env
```

---

## ✏️ What to Replace

Open `backend/.env` and locate **lines 10–11**:

```env
# ── AWS Credentials ─────────────────────────────────────────────────────────
# Replace the values below with your real AWS credentials.
# On EC2/ECS/Lambda: leave both blank and use an IAM role instead.
AWS_ACCESS_KEY_ID=<YOUR_ACCESS_KEY_ID_HERE>        # ← Replace this value
AWS_SECRET_ACCESS_KEY=<YOUR_SECRET_ACCESS_KEY_HERE> # ← Replace this value
AWS_REGION=us-east-1
```

### Example after editing:
```env
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1
```

---

## 📋 Step-by-Step Instructions

1. Open a terminal or File Explorer and navigate to:
   ```
   d:\project\multi-modal-assistant\backend\
   ```

2. Open `.env` in any text editor (VS Code, Notepad++, etc.)

3. Replace the value after `AWS_ACCESS_KEY_ID=` with your **Access Key ID**

4. Replace the value after `AWS_SECRET_ACCESS_KEY=` with your **Secret Access Key**

5. Save the file — **do NOT commit `.env` to Git** (it is already listed in `.gitignore`)

---

## 🔒 Security Rules — IMPORTANT

| Rule | Details |
|------|---------|
| ❌ Never commit `.env` | The `.gitignore` already excludes it — keep it that way |
| ❌ Never share keys in chat / email | Rotate immediately if exposed |
| ✅ Use IAM roles on cloud | On EC2/ECS/Lambda, leave both key fields blank and attach an IAM role instead |
| ✅ Use least-privilege IAM policy | Grant only the permissions your app needs (Bedrock, S3, Polly, Transcribe) |
| ✅ Rotate keys regularly | Rotate every 90 days or immediately after any suspected exposure |

---

## 🗂️ Reference — All Credential-Related Files

| File | Purpose | Should you edit? |
|------|---------|-----------------|
| `backend/.env` | **Live credentials** used at runtime | ✅ Yes — your real keys go here |
| `backend/.env.example` | Template / placeholder — safe to commit | ❌ No — leave it with placeholder values |
| `docker-compose.yml` | Reads from `backend/.env` via `env_file` | ❌ No — already wired up correctly |
| `README.md` → Setup section | Documents the setup process | ❌ No — documentation only |

---

## 🐳 Docker Users

If you run the app via Docker Compose, credentials are automatically loaded from `backend/.env` — no extra steps needed.

```yaml
# docker-compose.yml (already configured)
env_file:
  - ./backend/.env
```

---

## 🛑 Rotating Exposed Keys

If your AWS keys have been exposed (e.g., shared in a chat or committed to Git):

1. Go to **AWS Console → IAM → Users → Your User → Security Credentials**
2. Click **"Deactivate"** on the exposed access key
3. Click **"Create access key"** to generate a new pair
4. Update `backend/.env` with the new values
5. Delete the old deactivated key from IAM

> **[!CAUTION]**
> Do this immediately if keys are exposed — compromised keys can be used to rack up charges or exfiltrate data.
