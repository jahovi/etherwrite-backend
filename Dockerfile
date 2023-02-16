FROM node:16-slim

# Set to a non-root built-in user `node`
USER node

# Create app directory (with user `node`)
RUN mkdir -p /home/node/app

WORKDIR /home/node/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY --chown=node package*.json ./

RUN npm ci

# Bundle app source code
COPY --chown=node ./dist .

# Bind to all network interfaces so that it can be mapped to the host OS
EXPOSE 3000
HEALTHCHECK --timeout=10s CMD curl --fail http://localhost:8083/api/root/health || exit 1
CMD [ "node", "src/app.js" ]
