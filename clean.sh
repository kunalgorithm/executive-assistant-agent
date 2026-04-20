#!/bin/bash

to_remove=("node_modules" "src/generated" "dist" "build")

for item in "${to_remove[@]}"; do
    find . -name "$item" -type d -exec rm -rf {} +
done
