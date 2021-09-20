# MyIns Backend

For the best experience, open in VS Code with prettier installed :)

Used technologies:
- NestJS
- Prisma ORM
- Docker (for bootstrapping postgresql on dev, the project itself on prod)

To start, use: yarn run start:dev
After changing prisma files, run: prisma migrate dev

To build docker image for prod: docker compose build

Environment variables;
- DATABASE_URL: PostgresSQL database url
- JWT_SIGNING_KEY: Signing key used for JWT auth
- S3_KEY_ID
- S3_SECRET_ACCESS_KEY
- S3_ENDPOINT
- APNS_AUTH_KEY: Auth key for APNS
- APNS_AUTH_KEY_ID: See above
- APNS_AUTH_KEY_TEAM_ID: See above


Known issues:

- Post deletion does not work if the post has comments or likes
- Need some analytics for server to see which calls take the most time
- Multiple notifications are added if you like / unlike a post multiple times, need to constrain them.
- Delete old profile pictures when a new one is uploaded
- Access token in DB should be replaced by JWT
- Should switch to cursors instead of skip / take values for most feeds.
- It would be nice to have SuccessMessage class, return { "message": ${smth}}"


### Automatic deployment

To easily update the dev environment, simply push to develop in the [TODO] Repo. A build & release pipeline will automatically run & deploy the changes.

### Deploying to AWS manually

1. [TODO]
2. docker compose build backend
3. docker compose push backend

This will push it to the myins container registry. To apply the update, just restart it!


### The front-end

The frontend git repository is hosted on AWS CodeCommit, under the same organization as the Portal.
At the moment it's just one screen providing forgot password functionality.

Remaining DevOps:

- Only allow the container instance to connect to DB (atm firewall allows any IP)
- Enforce HTTPS only on APIs
- Proper taggging for Docker builds, don't just build latest
- Don't use SAS admin key for blobs, figure out something with per-user permissions
- Ensure delete user endpoint doesn't end up in prod
- Implement throttling on some endpoints (createUser / forgot password)
- Add redis layer for fast lookup (feed, etc.)