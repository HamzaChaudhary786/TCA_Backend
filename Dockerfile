FROM node:alpine3.19
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
EXPOSE 443
CMD ["npm", "run", "start"]