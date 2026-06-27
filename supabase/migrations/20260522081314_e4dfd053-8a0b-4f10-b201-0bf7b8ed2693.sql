
-- nyakalloletsela@gmail.com → admin only
DELETE FROM public.user_roles WHERE user_id = '6d653a26-c74a-442e-b1ca-74b94d007ab2' AND role <> 'admin';

-- nyakalloletsela@hotmail.com → tutor only
DELETE FROM public.user_roles WHERE user_id = '9e11e7a9-51ca-44b9-bf2a-cf56e3fcebb7' AND role <> 'tutor';

-- matlhonolofatsoletsela@gmail.com → already student only, no change needed
