import {
  hostToWsl, wslToHost, isWindowsPath, shq, wrapWslCommand, bridgeFromStatus, wslStopArgs,
} from "../src/lib/relion/wsl-bridge";

let fails = 0;
function eq(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fails++; console.log(`✗ ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
  else console.log(`✓ ${name}`);
}

// path translation
eq("drive→wsl", hostToWsl("C:\\Users\\me\\mics"), "/mnt/c/Users/me/mics");
eq("drive lower", hostToWsl("d:/data/x"), "/mnt/d/data/x");
eq("unc→wsl", hostToWsl("\\\\wsl.localhost\\Debian\\home\\user\\relion\\bin"), "/home/user/relion/bin");
eq("wsl$→wsl", hostToWsl("\\\\wsl$\\Ubuntu\\opt\\x"), "/opt/x");
eq("posix passthrough", hostToWsl("/home/z/x"), "/home/z/x");
eq("mnt→host", wslToHost("/mnt/c/Users/me/mics", "Debian"), "C:\\Users\\me\\mics");
eq("distro→host unc", wslToHost("/home/user/data", "Debian"), "\\\\wsl.localhost\\Debian\\home\\user\\data");
eq("posix passthrough back", wslToHost("/home/z/x", null), "/home/z/x");
eq("isWindows drive", isWindowsPath("C:\\x"), true);
eq("isWindows unc", isWindowsPath("\\\\wsl.localhost\\Debian"), true);
eq("isWindows posix", isWindowsPath("/mnt/c/x"), false);

// quoting
eq("shq plain", shq("/home/a b"), "'/home/a b'");
eq("shq quote", shq("it's"), "'it'\\''s'");

// bridge from statuses
const native = { execution: "native", found: true, path: "/home/z/relion-install/bin", wsl: { available: false, relionPath: null, relionHome: null, version: null, source: null, distro: null, note: "", available2: true } } as never;
eq("bridge null on native", bridgeFromStatus(native), null);
const wslStatus = {
  execution: "wsl", found: true, path: "/home/user/relion/bin",
  wsl: { available: true, relionPath: "/home/user/relion/bin", relionHome: "/home/user/relion", version: "5.0.1", source: "login-shell PATH", distro: "Debian", note: "", mpirunPath: "/usr/bin/mpirun", mpiBinary: true, ctffindPath: "/usr/bin/ctffind" },
} as never;
const bridge = bridgeFromStatus(wslStatus)!;
eq("bridge distro", bridge.distro, "Debian");
eq("bridge mpirun", bridge.mpirun, "/usr/bin/mpirun");
eq("bridge mpi", bridge.hasMpiBinary, true);

// wrap command — windows workdir args get translated, posix argv passes
const argv = [
  "/home/user/relion/bin/relion_refine_mpi",
  "--i", "C:\\Users\\me\\cryoflow\\data\\relion\\proj\\class2d_abc\\particles.star",
  "--o", "C:\\Users\\me\\cryoflow\\data\\relion\\proj\\class2d_abc\\run",
  "--K", "8",
];
const wrapped = wrapWslCommand(argv, "C:\\Users\\me\\cryoflow\\data\\relion\\proj", bridge);
eq("wrap file", wrapped.file, "wsl.exe");
eq("wrap args head", wrapped.args.slice(0, 2), ["-d", "Debian"]);
eq("wrap uses -e bash -c", wrapped.args.slice(2, 5), ["-e", "bash", "-c"]);
const script = wrapped.args[5] as string;
if (!script.includes("cd '/mnt/c/Users/me/cryoflow/data/relion/proj' || exit 111")) { fails++; console.log("✗ cd guard:", script.slice(0, 120)); } else console.log("✓ cd guard");
if (!script.includes("export RELION_HOME='/home/user/relion'")) { fails++; console.log("✗ RELION_HOME export"); } else console.log("✓ RELION_HOME export");
if (!script.includes("export PATH='/home/user/relion/bin':\"$PATH\"")) { fails++; console.log("✗ PATH export"); } else console.log("✓ PATH export");
if (!script.includes("export RELION_CTFFIND_EXECUTABLE='/usr/bin/ctffind'")) { fails++; console.log("✗ ctffind export"); } else console.log("✓ ctffind export");
if (!script.includes("exec '/home/user/relion/bin/relion_refine_mpi'")) { fails++; console.log("✗ exec binary quoted"); } else console.log("✓ exec binary quoted");
if (!script.includes("'/mnt/c/Users/me/cryoflow/data/relion/proj/class2d_abc/particles.star'")) { fails++; console.log("✗ windows arg translated"); } else console.log("✓ windows arg translated");
if (!script.includes("'8'")) { fails++; console.log("✗ numeric arg kept"); } else console.log("✓ numeric arg kept");
console.log("--- script ---\n" + script + "\n--- display ---\n" + wrapped.display);

// stop args (distro-name form — stopRun parses the distro from the RECORD)
eq("stop args", wslStopArgs("C:\\Users\\me\\cryoflow\\data\\relion\\proj\\class2d_abc", "Debian"), ["-d", "Debian", "-e", "pkill", "-f", "--", "/mnt/c/Users/me/cryoflow/data/relion/proj/class2d_abc"]);
eq("stop args no distro", wslStopArgs("C:\\a\\b", null).includes("-d"), false);

// record-based bridge detection (stopRun regex on the wrapped display cmd)
const disp = "wsl -d Debian -- bash -c cd '/mnt/d/x' || exit 111; exec '/home/u/rel/bin/relion_refine'";
const rm = disp.match(/^wsl(?: -d (\S+))? -- bash -c /);
eq("record bridge distro", rm?.[1], "Debian");
const rm2 = "wsl -- bash -c exec /x".match(/^wsl(?: -d (\S+))? -- bash -c /);
eq("record bridge default distro", rm2?.[1] ?? null, null);
const rm3 = "/home/z/relion-install/bin/relion_refine --i x".match(/^wsl(?: -d (\S+))? -- bash -c /);
eq("record bridge native null", rm3, null);

// no-distro variant: omit -d
const bridge2 = { ...bridge, distro: null };
const w2 = wrapWslCommand(["/x/bin/relion_refine", "--o", "C:\\a\\b"], "C:\\a", bridge2);
eq("no distro arg count", w2.args.length, 4); eq("no distro head", w2.args.slice(0, 3), ["-e", "bash", "-c"]);

console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
