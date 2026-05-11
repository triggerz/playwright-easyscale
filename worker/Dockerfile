FROM mcr.microsoft.com/playwright:v1.40.0-focal

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

ENV USER_RANGE_START=1
ENV USER_RANGE_END=1
ENV HEADLESS=true

CMD ["npm", "test"]
