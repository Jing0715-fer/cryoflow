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

    The mock's honest answer: the contract's SHAPE without a CNN — `x y`
    coordinate lines exactly like real topaz's output, so RELION's parsing
    stays fed.
    """
    nr = 40
    i = 0
    while i < len(argv):
        if argv[i] in ("-n", "--nr-particles") and i + 1 < len(argv):
            try:
                nr = max(1, int(float(argv[i + 1])))
            except ValueError:
                nr = 40
            i += 2
            continue
        i += 1
    for k in range(nr):
        x = 64 + (k * 37) % 384
        y = 64 + (k * 53) % 384
        print(f"{x} {y}")
    sys.stdout.flush()
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
