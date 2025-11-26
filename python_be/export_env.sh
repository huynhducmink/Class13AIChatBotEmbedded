#!/bin/bash
# Create environment.yml file for conda venv

conda env export --no-builds | grep -v "^prefix: " > environment.yml

# To create the same conda venv, run

# conda env create -f environment.yml