cd public/js
watchify main.js -o bundle.js &
cd ../..
node server.js &