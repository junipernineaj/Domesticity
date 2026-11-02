# Deploying Domesticity web to junipernine2

This runs the app on your Ubuntu server and makes it reachable at `domesticity.junipernine.com` through a Cloudflare Tunnel. The server opens no inbound ports. Cloudflare Access sits in front of the hostname, so only your email can get in.

You don't need a browser or a screen on the server. The tunnel is created in the Cloudflare dashboard on your Mac, and the server only runs one install command with a token. You open the site from your Mac's browser as normal.

Read ADR-0008 for the reasons. The steps below are for you to run on the server and in the Cloudflare dashboard. Nothing here changes Cloudflare or DNS automatically.

## Before you start

- Port 8095 is free: `ss -ltn | grep 8095` should print nothing. The recipe and photo apps are on other ports, so check if you want to use a different one.
- `junipernine.com` is managed in Cloudflare, so the tunnel can create `domesticity.junipernine.com` there.

## 0. Install Node 22 alongside the existing Node

The server's default Node is older (12 on junipernine2), and other apps may depend on it, so this installs Node 22 into its own folder and leaves the system Node alone:

```sh
uname -m                     # x86_64 -> linux-x64, aarch64 -> linux-arm64
cd /tmp
curl -fsSLO https://nodejs.org/dist/v22.23.4/node-v22.23.4-linux-x64.tar.xz
sudo mkdir -p /opt/node22
sudo tar -xJf node-v22.23.4-linux-x64.tar.xz -C /opt/node22 --strip-components=1
/opt/node22/bin/node -v      # should print v22.23.4
```

Use the `linux-arm64` file name if `uname -m` printed `aarch64`. The installer uses `/opt/node22/bin/node` and rewrites the service to match. Nothing else on the server uses it.

## 1. Install the app

From the top of your Domesticity checkout on the server (the folder that contains `web/`). Make sure it's on the latest `master` first:

```sh
cd ~/Domesticity
git pull origin master
sudo ./web/deploy/install.sh
```

No path argument is needed: the script finds the `web/` folder it's in. Re-run the same three commands to update after a change. The script creates a `domesticity` system user, copies the app to `/opt/domesticity/web`, runs the tests, installs the service, and checks it responds on `127.0.0.1:8095`.

Check it yourself:

```sh
systemctl status domesticity-web --no-pager
curl -s http://127.0.0.1:8095/ | head -5
```

## 2. Create the tunnel in the Cloudflare dashboard (on your Mac)

This is done in a browser on your Mac, not on the server.

1. Open the Cloudflare Zero Trust dashboard → **Networks → Tunnels → Create a tunnel**.
2. Choose **Cloudflared**, and name it `junipernine2`. (One tunnel can serve all the home apps, each with its own hostname.)
3. Cloudflare shows an install command for Debian/Ubuntu containing a long token. **Copy only the token** (the string after `--token`), and keep it private.
4. Under **Public hostnames**, add:
   - Subdomain: `domesticity`, Domain: `junipernine.com`
   - Service type: `HTTP`, URL: `127.0.0.1:8095`

   The URL is relative to the server, because cloudflared runs there.

## 3. Install cloudflared on the server with the token

On the server, install cloudflared using Cloudflare's current Ubuntu instructions (their apt repository), then:

```sh
cloudflared --version
sudo cloudflared service install <paste-the-token-here>
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared --no-pager
```

The tunnel should show as **Healthy** back in the dashboard within a minute.

At this point `https://domesticity.junipernine.com` answers, but **anyone on the internet can reach it**. Do step 4 before you use it.

## 4. Protect it with Cloudflare Access

This is the step that keeps the app private. In the Cloudflare Zero Trust dashboard:

1. **Access → Applications → Add an application → Self-hosted.**
2. Application domain: `domesticity.junipernine.com`. Give it a name like "Domesticity".
3. Add a policy: action **Allow**, include **Emails** and enter your own email address.
4. Identity provider: one-time PIN (email code) is enough for one person.
5. Save. Open the hostname in a private browser window to confirm it asks for your email and sends a code.

Until this is set up, do not add real data or share the link.

## 5. Check from your Mac

Open `https://domesticity.junipernine.com` in Safari, sign in with the emailed code, and you should see the Outstanding dashboard. On an iPhone, Share → Add to Home Screen gives you an app icon.

## Maintenance

- Logs: `journalctl -u domesticity-web -n 100`, and `journalctl -u cloudflared -n 100`.
- Restart: `sudo systemctl restart domesticity-web`.
- Update: `cd ~/Domesticity && git pull origin master`, then re-run `sudo ./web/deploy/install.sh`.
- Stop the public route without stopping the app: `sudo systemctl stop cloudflared`.
- Routes and hostnames are changed in the dashboard (Networks → Tunnels → junipernine2), not on the server.

## What this does not do yet

- The app has no login of its own. Cloudflare Access is the only gate, so keep the Access policy in place (ADR-0005 covers the app-level login to come).
- Data is still in memory, so restarting the service resets it (Phase 0).
