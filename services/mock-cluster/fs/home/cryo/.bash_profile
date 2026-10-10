# mock cluster login profile
# /etc/profile (sourced first by `bash -l`) resets PATH, so re-export the
# mock-cluster PATH that the SSH server passes via the environment — the app
# runs commands through `bash -lc '…'` and must find fs/opt/bin/module.
if [ -n "$CRYOFLOW_MOCK_PATH" ]; then
  export PATH="$CRYOFLOW_MOCK_PATH"
fi
true
# t534 — same dance as PATH: the topaz python-module shim rides PYTHONPATH
# (the real relion_python_topaz wrapper imports the topaz module by name).
if [ -n "$CRYOFLOW_MOCK_PYTHONPATH" ]; then
  export PYTHONPATH="$CRYOFLOW_MOCK_PYTHONPATH"
fi
