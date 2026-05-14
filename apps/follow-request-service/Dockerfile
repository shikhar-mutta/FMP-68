FROM node:22

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npx prisma generate

RUN npx nest build

EXPOSE 3003

CMD ["node", "dist/main"]