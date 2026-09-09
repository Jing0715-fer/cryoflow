#!/bin/bash
# production server for QA under memory pressure — no Turbopack compile
# spikes, prebuilt routes; survives the tool-call reaper via setsid
cd /home/z/my-project
pkill -f "next start" 2>/dev/null
pkill -f "next-server" 2>/dev/null
sleep 1
export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--max-old-space-size=896"
setsid bun run start >/dev/null 2>&1 < /dev/null &
exit 0
