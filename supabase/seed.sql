-- Optional demo data (same records the in-memory store seeds).
-- record_hash uses the app's canonical format: serial|nim|name|issueDate
select public.issue_diploma(
  'DPL-2026-CS-001',
  jsonb_build_object(
    'studentId', '123200045',
    'studentName', 'Alexander Wright',
    'issueDate', '2026-08-15',
    'major', 'Computer Science',
    'university', 'Pacific Institute of Technology'
  ),
  encode(extensions.digest('DPL-2026-CS-001|123200045|Alexander Wright|2026-08-15', 'sha256'), 'hex')
);

select public.issue_diploma(
  'DPL-2026-IS-002',
  jsonb_build_object(
    'studentId', '123200088',
    'studentName', 'Sarah Jenkins',
    'issueDate', '2026-08-15',
    'major', 'Information Systems',
    'university', 'Metropolitan University'
  ),
  encode(extensions.digest('DPL-2026-IS-002|123200088|Sarah Jenkins|2026-08-15', 'sha256'), 'hex')
);
