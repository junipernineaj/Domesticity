# Deploying Domesticity web to junipernine2

This runs the app on your Ubuntu server and makes it reachable at `domesticity.junipernine.com` through a Cloudflare Tunnel. The server opens no inbound ports. Cloudflare Access sits in front of the hostname, so only your email can get in.

Read ADR-0008 for the reasons. The steps below are for you to run on the server and in the Cloudflare dashboard. Nothing here changes Cloudflare or DNS automatically.

## Before you start

- Node 22 or later on the server: `node -v`. Note the path with `command -v node`. If it isn't `/usr/bin/node`, edit `ExecStart` in `domesticity-web.service`.
- Port 8095 is free: `ss -ltn | grep 8095` should print nothing. The recipe and photo apps are on other ports, so check if you want to use a different one.
- `junipernine.com` is managed in Cloudflare, so the tunnel can create `domesticity.junipernine.com` there.

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

## 2. Install cloudflared

Follow Cloudflare's current install instructions for Ubuntu (their apt repository). Then check:

```sh
cloudflared --version
```

## 3. Create the tunnel

On the server:

```sh
cloudflared tunnel login                  # opens a browser; pick junipernine.com
cloudflared tunnel create domesticity     # prints a tunnel UUID and writes a credentials JSON
cloudflared tunnel route dns domesticity domesticity.junipernine.com
```

Copy the config and fill in the UUID from the previous step (it appears in both the config and the credentials filename):

```sh
sudo mkdir -p /etc/cloudflared
sudo cp ~/domesticity/web/deploy/cloudflared-config.yml /etc/cloudflared/config.yml
sudo sed -i 's/REPLACE-WITH-TUNNEL-UUID/<your-uuid>/g' /etc/cloudflared/config.yml
sudo mv ~/.cloudflared/<your-uuid>.json /etc/cloudflared/
sudo chmod 600 /etc/cloudflared/<your-uuid>.json
```

Install it as a service and start it:

```sh
sudo cloudflared service install
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared --no-pager
```

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
- Update: `git pull` in `~/domesticity`, then re-run `install.sh`.
- Stop the public route without stopping the app: `sudo systemctl stop cloudflared`.

## What this does not do yet

- The app has no login of its own. Cloudflare Access is the only gate, so keep the Access policy in place (ADR-0005 covers the app-level login to come).
- Data is still in memory, so restarting the service resets it (Phase 0).
