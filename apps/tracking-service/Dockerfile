FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npx nest build

EXPOSE 3003

CMD ["node", "dist/src/main"]