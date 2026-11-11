FROM postgres:17-alpine

RUN apk add --no-cache rclone tzdata

COPY backup.sh /usr/local/bin/backup.sh
COPY crontab /etc/crontabs/root

RUN chmod 700 /usr/local/bin/backup.sh \
    && chmod 600 /etc/crontabs/root

ENTRYPOINT ["crond", "-f", "-l", "2"]