-- 깨알지식: 회원 홈 대시보드용 짧은 트레이닝 Q&A
CREATE TABLE IF NOT EXISTS public.bite_sized_knowledge (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  question   text        NOT NULL,
  answer     text        NOT NULL,
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bite_sized_knowledge_active_idx
  ON public.bite_sized_knowledge (is_active)
  WHERE is_active = true;

ALTER TABLE public.bite_sized_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bite_sized_knowledge_select_active"
  ON public.bite_sized_knowledge
  FOR SELECT
  TO authenticated
  USING (is_active = true);

GRANT SELECT ON public.bite_sized_knowledge TO authenticated;

INSERT INTO public.bite_sized_knowledge (question, answer) VALUES
  (
    '운동 전 워밍업은 꼭 해야 하나요?',
    '5~10분 가벼운 유산소와 동작 범위 확보는 부상 예방과 운동 효율을 높입니다. 본 운동 전 관절·근육을 깨우는 습관을 추천합니다.'
  ),
  (
    '근력 운동 후 단백질은 언제 섭취하면 좋을까요?',
    '운동 후 2시간 이내 단백질·탄수화물을 함께 섭취하면 회복과 근합성에 도움이 됩니다. 하루 총량을 맞추는 것이 더 중요합니다.'
  ),
  (
    '통증이 있는데 운동을 계속해도 될까요?',
    '날카로운 통증·관절 통증은 휴식과 전문가 상담이 우선입니다. 근육 피로와 불편함은 구분해, 가벼운 활동으로 회복을 돕는 편이 안전합니다.'
  );
