"""CryoFlow mock-cluster topaz — the python-module contract shim (t534).

The REAL relion_python_topaz wrapper (the conda env script every RELION 5
install ships) runs `python -c "from topaz.main import main; ..."`. On the
mock cluster that module did not exist, so the wrapper died with the PYTHON
ERROR banner — and since t530 the REAL relion_autopick (first on MOCK_PATH)
drives the training, its run died inside the wrapper. The t533 doctrine:
"mock learns the real pieces it lacks" — this module IS the piece. It speaks
the topaz CLI contract with the wild-shape epoch dialect the app's
topaz-training parser (and the t266 suite) reads:

    ## epoch N training loss=0.xxxx precision=0.xxx recall=0.xxx
    ## test  loss=... (held-out split on its own line)

The real trainTopaz (autopicker.cpp:2957) composes
    <fn_topaz_exe> train -n <nr> -r <radius> -o <odir>model_training.txt
    --num-threads=N --num-workers=N --train-images=... --test-images=...
    --train-targets=... --test-targets=... --save-prefix=<odir>model
and appends stdout to run.out — so printing here IS writing the log the
route reads. Model files follow real topaz's <save-prefix>epochN.sav; a
topaz_model.sav twin keeps the engine's output discovery (glob *.sav) and
the e2e's byte-identity assertions fed.
"""
import os
import sys
import time


def _epochs():
    """The stub autopick's wild-shape numbers, kept byte-compatible."""
    loss = 0.62
    rows = []
    for epoch in range(5):
        loss *= 0.72
        test = loss * 1.13
        prec = min(0.91, 0.42 + epoch * 0.11)
        rec = min(0.88, 0.55 + epoch * 0.07)
        rows.append(
            (f"## epoch {epoch} training loss={loss:.4f} precision={prec:.3f} recall={rec:.3f}",
             f"## test loss={test:.4f} precision={min(0.88, prec - 0.03):.3f} recall={min(0.85, rec - 0.02):.3f}",
             loss)
        )
    return rows


def train(argv):
    out_file = None
    save_prefix = None
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "-o" and i + 1 < len(argv):
            out_file = argv[i + 1]
            i += 2
            continue
        if a == "--save-prefix" and i + 1 < len(argv):
            save_prefix = argv[i + 1]
            i += 2
            continue
        i += 1

    rows = _epochs()

    # t534 — the head-guard filler. trainTopaz runs the train script as
    # `>> run.out` while the REAL binary holds the same file via `>` with a
    # BLOCK-BUFFERED stdout; the binary flushes its banner + closing lines
    # AT EXIT — at byte offset 0 — clobbering whatever the script appended
    # there first (epoch 0 died exactly this way: run.out carried epochs
    # 1-4 and a banner sitting where epoch 0 had been). A single long line
    # ahead of the epochs gives that flush harmless bytes to land on.
    print("#" + " topaz training session (cryoflow-mock) " + "-" * 2048)
    sys.stdout.flush()
    for train_line, test_line, _ in rows:
        time.sleep(0.3)  # the honest-pace law: a beat a human can see
        print(train_line)
        print(test_line)
        sys.stdout.flush()

    # the -o table (real topaz writes the training curve there)
    if out_file:
        try:
            os.makedirs(os.path.dirname(out_file) or ".", exist_ok=True)
            with open(out_file, "w") as fh:
                for train_line, test_line, _ in rows:
                    fh.write(train_line + "\n" + test_line + "\n")
        except OSError:
            pass  # a receipt never blocks the verdict

    # the models: real topaz saves <prefix>epochN.sav; topaz_model.sav keeps
    # the engine's glob (*.sav) discovery and the suite's twin assertions fed
    body = b"CRYOFLOW-MOCK-TOPAZ-MODEL-v1\n" + bytes(range(256)) * 3
    if save_prefix:
        try:
            os.makedirs(os.path.dirname(save_prefix) or ".", exist_ok=True)
            for epoch in range(5):
                p = f"{save_prefix}epoch{epoch}.sav"
                with open(p, "wb") as fh:
                    fh.write(body + f"\nepoch={epoch}\n".encode())
        except OSError:
            pass
    model = out_file.replace("model_training.txt", "topaz_model.sav") if out_file else None
    if model and not os.path.exists(model):
        try:
            with open(model, "wb") as fh:
                fh.write(body + b"\n")
        except OSError:
            pass

    print("Topaz model trained (5 epochs) — connect it into Auto-picking (Topaz mode)")
    sys.stdout.flush()
    return 0


def extract(argv):
    """Topaz extract: predict coordinates with a trained model.

    t535 — the REAL relion_autopick's contract (autopicker.cpp
    autoPickTopazOneMicrograph): it preprocesses the micrograph itself into
    <odir>proc/rank<N>.mrc, runs `<topaz_exe> extract … -o
    <odir>proc/rank<N>.txt <odir>proc/rank<N>.mrc`, and reads the -o FILE
    back with readTopazCoordinates — a first header line carrying at least
    three columns named x_coord / y_coord / score, then one row per pick.
    The pre-t535 face printed bare `x y` lines to STDOUT, so the real
    binary died "readTopazCoordinate ERROR: Cannot open input file …
    proc/rank000000.txt" (t264's C5). The mock writes the file now, with
    picks placed on a fixed lattice inside the image's own dims (read from
    the mrc header — no CNN, but an honest in-bounds answer).
    """
    import struct

    out_file = None
    src = None
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "-o" and i + 1 < len(argv):
            out_file = argv[i + 1]
            i += 2
            continue
        if a in ("-n", "--nr-particles") and i + 1 < len(argv):
            i += 2
            continue
        if not a.startswith("-") and src is None:
            src = a
        i += 1

    if out_file is None:
        sys.stderr.write("cryoflow-mock topaz extract: no -o output file given\n")
        return 1

    # the processed micrograph's dims (nx @0, ny @4, mode @12 — int32 LE)
    nx, ny = 512, 512
    if src and os.path.exists(src):
        try:
            with open(src, "rb") as fh:
                head = fh.read(1024)
                nx, ny = struct.unpack("<ii", head[0:8])
        except Exception:
            pass
    if nx <= 0 or ny <= 0:
        nx, ny = 512, 512

    # a deterministic lattice of picks, in-bounds, with descending scores —
    # the shape RELION parses, the physics the mock can honestly afford
    nr = 24
    lines = ["x_coord\ty_coord\tscore"]
    for k in range(nr):
        x = int(nx * (0.1 + 0.8 * ((k * 7) % 10) / 9.0))
        y = int(ny * (0.1 + 0.8 * ((k * 13) % 10) / 9.0))
        lines.append("%d\t%d\t%.4f" % (x, y, 1.0 - k / float(nr)))
    with open(out_file, "w") as fh:
        fh.write("\n".join(lines) + "\n")
    return 0


def main():
    argv = sys.argv[1:]
    sub = argv[0] if argv else ""
    if sub == "train":
        sys.exit(train(argv[1:]))
    if sub == "extract":
        sys.exit(extract(argv[1:]))
    print(f"cryoflow-mock topaz: unknown subcommand {sub!r} (train | extract)", file=sys.stderr)
    sys.exit(2)
