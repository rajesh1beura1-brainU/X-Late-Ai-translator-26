import fetch from 'node-fetch';

const baseUrl = 'http://localhost:3000';

async function runAuditTests() {
  console.log('=== STARTING V1 END-TO-END AUDIT TESTS ===\n');

  // Helper fetch with Bearer token header for user identity
  const api = async (path, options = {}, userId = 'user-a-123', email = 'usera@test.com') => {
    const res = await fetch(baseUrl + path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userId}`,
        'x-user-email': email,
        ...(options.headers || {})
      }
    });
    const text = await res.text();
    try {
      return { status: res.status, data: JSON.parse(text) };
    } catch {
      return { status: res.status, data: text };
    }
  };

  // --- TEST A: RLS & Cross-User Isolation ---
  console.log('--- TEST A: Cross-User Isolation ---');
  // User A creates memory & account
  const procA = await api('/api/brain/extract', {
    method: 'POST',
    body: JSON.stringify({ input: 'Met Alice at Beta Corp about Q3 contract.' })
  }, 'user-a-123', 'usera@test.com');
  
  if (procA.data) {
    await api('/api/brain/confirm', {
      method: 'POST',
      body: JSON.stringify({ ...procA.data, raw_input: 'Met Alice at Beta Corp about Q3 contract.' })
    }, 'user-a-123', 'usera@test.com');
  }

  const accountsA = await api('/api/accounts', {}, 'user-a-123', 'usera@test.com');
  const accountsB = await api('/api/accounts', {}, 'user-b-456', 'userb@test.com');

  console.log('User A accounts count:', accountsA.data?.length || 0);
  console.log('User B accounts count:', accountsB.data?.length || 0);
  console.log('Cross-User Leakage Check:', accountsB.data?.length === 0 ? 'PASSED (0 items leaked)' : 'FAILED (Leak detected)');

  // --- TEST B: Brain Input Flow ("Met Priya from ABC Technologies...") ---
  console.log('\n--- TEST B: Brain Input Extraction & Creation ---');
  const inputB = 'Met Priya from ABC Technologies. She wants revised pricing by Monday.';
  const procB = await api('/api/brain/extract', {
    method: 'POST',
    body: JSON.stringify({ input: inputB })
  }, 'user-a-123', 'usera@test.com');

  console.log('Extraction Result B:', JSON.stringify(procB.data, null, 2));

  let confirmB = null;
  if (procB.data) {
    confirmB = await api('/api/brain/confirm', {
      method: 'POST',
      body: JSON.stringify({ ...procB.data, raw_input: inputB })
    }, 'user-a-123', 'usera@test.com');
  }
  console.log('Confirm Result B status:', confirmB?.status);

  // Check database state after confirm
  const accountsAfterB = await api('/api/accounts', {}, 'user-a-123', 'usera@test.com');
  const peopleAfterB = await api('/api/people', {}, 'user-a-123', 'usera@test.com');
  const tasksAfterB = await api('/api/tasks', {}, 'user-a-123', 'usera@test.com');
  const timelineAfterB = await api('/api/timeline', {}, 'user-a-123', 'usera@test.com');

  console.log('Account created:', accountsAfterB.data?.find(a => a.name.includes('ABC'))?.name || 'NOT FOUND');
  console.log('Person created:', peopleAfterB.data?.find(p => p.name.includes('Priya'))?.name || 'NOT FOUND');
  console.log('Tasks created count:', tasksAfterB.data?.tasks?.length || 0);
  console.log('Commitments created count:', tasksAfterB.data?.commitments?.length || 0);
  console.log('Timeline events count:', timelineAfterB.data?.length || 0);

  // --- TEST C: Repeat Interaction Association ---
  console.log('\n--- TEST C: Repeat Interaction Association ---');
  const inputC = 'Spoke with Priya at ABC Technologies regarding software deployment in September.';
  const procC = await api('/api/brain/extract', {
    method: 'POST',
    body: JSON.stringify({ input: inputC })
  }, 'user-a-123', 'usera@test.com');

  console.log('Repeat Extraction Candidate Account:', procC.data?.account_candidate?.name);
  console.log('Repeat Extraction Candidate Person:', procC.data?.person_candidates?.[0]?.name);

  if (procC.data) {
    await api('/api/brain/confirm', {
      method: 'POST',
      body: JSON.stringify({ ...procC.data, raw_input: inputC })
    }, 'user-a-123', 'usera@test.com');
  }

  // --- TEST D: Context Delta Engine ---
  console.log('\n--- TEST D: Context Delta Engine ---');
  const inputD = 'Deployment at ABC Technologies moved from September to October.';
  const procD = await api('/api/brain/extract', {
    method: 'POST',
    body: JSON.stringify({ input: inputD })
  }, 'user-a-123', 'usera@test.com');

  if (procD.data) {
    await api('/api/brain/confirm', {
      method: 'POST',
      body: JSON.stringify({ ...procD.data, raw_input: inputD })
    }, 'user-a-123', 'usera@test.com');
  }

  const changesD = await api('/api/changes', {}, 'user-a-123', 'usera@test.com');
  console.log('Context Deltas recorded count:', changesD.data?.length || 0);
  console.log('Delta Details:', JSON.stringify(changesD.data, null, 2));

  // --- TEST E: Account Merge & Reversibility / Undo ---
  console.log('\n--- TEST E: Account Merge & Undo ---');
  // Create duplicate account
  const procDup = await api('/api/brain/extract', {
    method: 'POST',
    body: JSON.stringify({ input: 'Meeting with ABC Tech Inc about trial.' })
  }, 'user-a-123', 'usera@test.com');
  if (procDup.data) {
    await api('/api/brain/confirm', {
      method: 'POST',
      body: JSON.stringify({ ...procDup.data, raw_input: 'Meeting with ABC Tech Inc about trial.' })
    }, 'user-a-123', 'usera@test.com');
  }

  const currentAccounts = await api('/api/accounts', {}, 'user-a-123', 'usera@test.com');
  console.log('Current Accounts:', currentAccounts.data?.map(a => a.name));
  const sourceAcc = currentAccounts.data?.[1];
  const destAcc = currentAccounts.data?.[0];

  if (sourceAcc && destAcc) {
    console.log('Merging source:', sourceAcc.name, '(', sourceAcc.id, ') -> destination:', destAcc.name, '(', destAcc.id, ')');
    const preview = await api('/api/reconciliation/merge/preview', {
      method: 'POST',
      body: JSON.stringify({ source_account_id: sourceAcc.id, destination_account_id: destAcc.id })
    }, 'user-a-123', 'usera@test.com');
    console.log('Merge preview output:', preview.data);

    const exec = await api('/api/reconciliation/merge/execute', {
      method: 'POST',
      body: JSON.stringify({ source_account_id: sourceAcc.id, destination_account_id: destAcc.id })
    }, 'user-a-123', 'usera@test.com');
    console.log('Merge execution status:', exec.status, exec.data?.message || exec.data);

    const undo = await api('/api/reconciliation/merge/undo', {
      method: 'POST',
      body: JSON.stringify({ merge_operation_id: exec.data?.operation_id })
    }, 'user-a-123', 'usera@test.com');
    console.log('Merge undo status:', undo.status, undo.data?.message || undo.data);
  } else {
    console.log('Merge test skipped: Accounts not found');
  }

  // --- TEST F: Grounded Ask Brain Retrieval ---
  console.log('\n--- TEST F: Ask Brain Grounded Retrieval ---');
  const askFound = await api('/api/ask', {
    method: 'POST',
    body: JSON.stringify({ query: 'What did Priya say about pricing?' })
  }, 'user-a-123', 'usera@test.com');
  console.log('Ask Brain (Known Fact):', askFound.data?.answer);
  console.log('Sources cited count:', askFound.data?.sources?.length || 0);

  const askUnknown = await api('/api/ask', {
    method: 'POST',
    body: JSON.stringify({ query: 'What is the secret unlock key for Project Zeta?' })
  }, 'user-a-123', 'usera@test.com');
  console.log('Ask Brain (Unknown Fact):', askUnknown.data?.answer);

  // --- TEST G: Consent & Compliance Ledger ---
  console.log('\n--- TEST G: Consent & Compliance Ledger ---');
  const compliance = await api('/api/compliance', {}, 'user-a-123', 'usera@test.com');
  console.log('Consent records count:', compliance.data?.consents?.length || 0);
  console.log('Compliance ledger entries count:', compliance.data?.ledger?.length || 0);

  console.log('\n=== AUDIT TESTS COMPLETE ===');
}

runAuditTests();
