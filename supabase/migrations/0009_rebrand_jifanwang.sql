-- Rebrand: Coco Chick → 鸡饭王 / JI FAN WANG.
-- Updates the franchisees.business_name and contact emails on the live
-- rows so the admin dashboard's mock↔real matching (which keys off
-- business_name) keeps working after the mock-data.ts rename.
--
-- Idempotent: using UPDATE ... WHERE old_value so re-running is safe.

update public.franchisees set business_name = '鸡饭王 PJ Sdn Bhd'       where business_name = 'Coco Chick PJ Sdn Bhd';
update public.franchisees set business_name = '鸡饭王 Central Sdn Bhd'  where business_name = 'Coco Chick Central Sdn Bhd';
update public.franchisees set business_name = '鸡饭王 Johor Sdn Bhd'    where business_name = 'Coco Chick Johor Sdn Bhd';
update public.franchisees set business_name = '鸡饭王 Borneo Sdn Bhd'   where business_name = 'Coco Chick Borneo Sdn Bhd';

update public.franchisees set email = 'lim@jifanwang.my'    where email = 'lim@cocochick.my';
update public.franchisees set email = 'priya@jifanwang.my'  where email = 'priya@cocochick.my';
update public.franchisees set email = 'fadzli@jifanwang.my' where email = 'fadzli@cocochick.my';
update public.franchisees set email = 'kevin@jifanwang.my'  where email = 'kevin@cocochick.my';

-- Tidy up the demo training-module description so it reads on-brand.
update public.training_modules
   set description = 'End-to-end tour of the 鸡饭王 POS, reports, and cashier shortcuts.'
 where title = 'POS System Walkthrough';

-- Rename the pinned welcome announcement so the "Welcome to the Coco
-- Chick Portal" row in public.announcements matches the new brand.
update public.announcements
   set title = 'Welcome to the JI FAN WANG Portal'
 where title = 'Welcome to the Coco Chick Portal';
