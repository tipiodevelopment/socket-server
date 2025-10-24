FROM node:20

ARG SV_APP_ID
ARG SV_PASSWORD
ARG SV_TENANT_ID
ARG AZ_STORAGE

ENV SV_APP_ID=$SV_APP_ID
ENV SV_PASSWORD=$SV_PASSWORD
ENV SV_TENANT_ID=$SV_TENANT_ID
ENV AZ_STORAGE=$AZ_STORAGE

EXPOSE 3000

CMD ["yarn", "start"]

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json ./
RUN yarn install

# Env File
RUN apt-get install curl -y
RUN curl -sL https://aka.ms/InstallAzureCLIDeb -o azure-install-script.sh
RUN chmod +x azure-install-script.sh
RUN ./azure-install-script.sh
RUN az login --service-principal -u "${SV_APP_ID}" -p "${SV_PASSWORD}" --tenant "${SV_TENANT_ID}"
RUN az storage blob download \
    --account-name "${AZ_STORAGE}" \
    --container-name env-file-microservices \
    --name socket-server/.env  \
    --file .env \
    --auth-mode login

RUN ls

# Create production bundle
COPY . ./
RUN yarn build