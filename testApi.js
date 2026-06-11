async function main() {
  try {
    console.log("Testing psxterminal...");
    const r = await fetch('https://psxterminal.com/api/fundamentals/HUBC');
    const d = await r.json();
    console.log(JSON.stringify(d.data, null, 2));
  } catch(err) {
    console.log('Error:', err.message);
  }
}
main();