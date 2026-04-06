-- 관리자가 예약 정리 시 attendance_logs 좀비 행을 클라이언트에서 삭제할 수 있도록

DROP POLICY IF EXISTS "Admins can delete attendance logs" ON public.attendance_logs;

CREATE POLICY "Admins can delete attendance logs"
  ON public.attendance_logs
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
