FROM node:14 as builder
ENV NODE_ENV=${NODE_ENV}

RUN mkdir -p /app/backend

WORKDIR /app/backend

COPY ./package*.json /app/backend
COPY ./yarn.lock /app/backend
COPY ./runProd.sh /app/backend
RUN yarn install

COPY ./prisma /app/backend/prisma
RUN yarn run prisma generate

ADD ./ /app/backend
RUN yarn run build

FROM node:13.7

COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/package.json ./
COPY --from=builder /app/backend/yarn.lock ./
COPY --from=builder /app/backend/runProd.sh ./
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/prisma ./prisma

CMD ["sh", "runProd.sh"]