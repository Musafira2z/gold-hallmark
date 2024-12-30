# Use Node.js as the base image for building the React app
FROM node:20 AS build

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Set environment variable for the API URL
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=${REACT_APP_API_URL}

# Build the React app
RUN npm run build

# Use Nginx to serve the React app
FROM nginx:alpine

# Copy the build output to the Nginx web server directory
COPY --from=build /app/dist /usr/share/nginx/html

# Expose the port on which Nginx runs
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
