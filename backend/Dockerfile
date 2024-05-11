# Use a Node.js base image
FROM node:18

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

# Build TypeScript files
RUN npm run build

# Expose the application port
EXPOSE 5001

# Run the app
CMD ["node", "dist/index.js"]
