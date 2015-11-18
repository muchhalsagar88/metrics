#!/bin/bash

git clone -b $1 https://github.com/rchakra3/simple-flask-app.git
cd simple-flask-app
pip install -r requirements.txt
python src/app.py
