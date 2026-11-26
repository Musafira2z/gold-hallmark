# Test box for the desktop app: Ubuntu 22.04 with MongoDB 7 (same as the Docker app), Node 22, a virtual screen.
FROM mongo:7
RUN apt-get update -qq && apt-get install -y -qq curl ca-certificates xvfb xauth netcat-openbsd iproute2 libnss3-tools \
      libgtk-3-0 libnss3 libasound2 libgbm1 libxss1 libxshmfence1 libdrm2 >/dev/null \
 && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null \
 && apt-get install -y -qq nodejs >/dev/null && rm -rf /var/lib/apt/lists/*
