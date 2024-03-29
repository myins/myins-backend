FROM public.ecr.aws/bitnami/node:latest as builder
ENV NODE_ENV=${NODE_ENV}

RUN mkdir -p /app/backend

WORKDIR /app/backend

COPY ./package*.json /app/backend/
COPY ./yarn.lock /app/backend
COPY ./runProd.sh /app/backend
RUN yarn install

COPY ./prisma /app/backend/prisma
RUN yarn run prisma generate

ADD ./ /app/backend
RUN yarn run build

FROM public.ecr.aws/bitnami/node:latest

COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/package.json ./
COPY --from=builder /app/backend/yarn.lock ./
COPY --from=builder /app/backend/runProd.sh ./
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/prisma ./prisma

EXPOSE 3000

#CMD ["sh", "runProd.sh"]