# mock cluster login profile
# /etc/profile (sourced first by `bash -l`) resets PATH, so re-export the
# mock-cluster PATH that the SSH server passes via the environment — the app
# runs commands through `bash -lc '…'` and must find fs/opt/bin/module.
if [ -n "$CRYOFLOW_MOCK_PATH" ]; then
  export PATH="$CRYOFLOW_MOCK_PATH"
fi
true
