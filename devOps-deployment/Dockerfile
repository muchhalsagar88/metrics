FROM ubuntu:14.04
COPY get-pip.py scripts/get-pip.py
RUN echo "deb http://archive.ubuntu.com/ubuntu/ $(lsb_release -sc) main universe" >> /etc/apt/sources.lis$
RUN apt-get -y update
RUN apt-get -y build-dep build-essential
RUN apt-get install -y python python-dev python-distribute
RUN python scripts/get-pip.py
RUN apt-get -y install git
COPY run_server.sh scripts/run_server.sh

