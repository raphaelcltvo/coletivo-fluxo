-- "Prazo estourado" e "Resumo de pendências" não têm um evento que os
-- dispare — rodam 1x/dia via pg_cron, inserindo em fluxo_notifications
-- (o mesmo webhook -> send-alert-email de sempre cuida do e-mail).
create extension if not exists pg_cron;

-- Atrasado: 1 notificação por card+pessoa quando o prazo já passou e o
-- card não está concluído/arquivado. Não repete todo dia — só de novo se
-- ninguém mexeu no card nos últimos 3 dias.
create or replace function fluxo_notify_overdue() returns void as $$
declare
  d record;
  assignee_id uuid;
  days_over int;
begin
  for d in
    select fd.id, fd.title, fd.due_date, fd.assignee_ids, fc.name as client_name
    from fluxo_demands fd
    left join fluxo_clients fc on fc.id = fd.client_id
    where fd.due_date is not null
      and fd.due_date < current_date
      and fd.status <> 'concluida'
      and fd.archived_at is null
  loop
    days_over := current_date - d.due_date;
    for assignee_id in select jsonb_array_elements_text(coalesce(d.assignee_ids, '[]'::jsonb))::uuid
    loop
      if not exists (
        select 1 from fluxo_notifications n
        where n.kind = 'atrasado' and n.member_id = assignee_id and n.demand_id = d.id
          and n.created_at > now() - interval '3 days'
      ) then
        insert into fluxo_notifications (member_id, message, demand_id, read, kind, data)
        values (
          assignee_id,
          format('Atrasado: "%s" venceu há %s dia(s)', d.title, days_over),
          d.id, false, 'atrasado',
          jsonb_build_object('titulo', d.title, 'cliente', coalesce(d.client_name, ''), 'dias', days_over, 'prazo', to_char(d.due_date, 'DD/MM'))
        );
      end if;
    end loop;
  end loop;
end;
$$ language plpgsql security definer;

-- Resumo diário: 1 e-mail por pessoa ativa, só se tiver pelo menos 1
-- pendência (atrasado, thread aguardando resposta, ou alerta de hoje).
-- Não manda 2x no mesmo dia pra mesma pessoa.
create or replace function fluxo_notify_daily_digest() returns void as $$
declare
  m record;
  overdue_json jsonb;
  waiting_json jsonb;
  alerts_json jsonb;
  overdue_count int;
  waiting_count int;
  alerts_count int;
  total int;
  weekday_pt text;
begin
  weekday_pt := (array['domingo','segunda','terça','quarta','quinta','sexta','sábado'])[extract(dow from current_date)::int + 1];

  for m in select id, name, role from fluxo_profiles where status = 'ativo'
  loop
    select coalesce(jsonb_agg(jsonb_build_object(
        'titulo', fd.title, 'cliente', coalesce(fc.name, ''), 'dias', (current_date - fd.due_date)
      )), '[]'::jsonb), count(*)
      into overdue_json, overdue_count
    from fluxo_demands fd
    left join fluxo_clients fc on fc.id = fd.client_id
    where fd.due_date is not null and fd.due_date < current_date
      and fd.status <> 'concluida' and fd.archived_at is null
      and fd.assignee_ids ? m.id::text;

    select coalesce(jsonb_agg(jsonb_build_object(
        'titulo', left(fp.message, 60), 'cliente', coalesce(fc.name, '')
      )), '[]'::jsonb), count(*)
      into waiting_json, waiting_count
    from fluxo_posts fp
    left join fluxo_clients fc on fc.id = fp.client_id
    where (
        fp.audience = 'todos' or fp.author_id = m.id
        or exists (select 1 from fluxo_post_recipients pr where pr.post_id = fp.id and pr.member_id = m.id)
      )
      and not exists (select 1 from fluxo_post_reads r where r.post_id = fp.id and r.member_id = m.id)
      and not exists (select 1 from fluxo_post_replies rep where rep.post_id = fp.id and rep.author_id = m.id)
      and (
        exists (select 1 from fluxo_post_replies rep2 where rep2.post_id = fp.id and rep2.author_id <> m.id)
        or exists (select 1 from fluxo_post_likes pl where pl.post_id = fp.id and pl.member_id <> m.id)
      );

    select coalesce(jsonb_agg(jsonb_build_object(
        'titulo', fa.title, 'cliente', coalesce(fc.name, '')
      )), '[]'::jsonb), count(*)
      into alerts_json, alerts_count
    from fluxo_alerts fa
    left join fluxo_clients fc on fc.id = (case when jsonb_array_length(coalesce(fa.client_ids, '[]'::jsonb)) = 1 then fa.client_ids->>0 else null end)
    where fa.scheduled_date = current_date and fa.status = 'agendado'
      and (
        (fa.destino->>'everyone')::boolean is true
        or (fa.destino->'roles' ? m.role)
        or (fa.destino->'memberIds' ? m.id::text)
      );

    total := overdue_count + waiting_count + alerts_count;
    if total > 0 and not exists (
      select 1 from fluxo_notifications n
      where n.kind = 'resumo' and n.member_id = m.id and n.created_at::date = current_date
    ) then
      insert into fluxo_notifications (member_id, message, demand_id, read, kind, data)
      values (
        m.id, format('Seu resumo de %s: %s pendências', weekday_pt, total), null, false, 'resumo',
        jsonb_build_object('dia', weekday_pt, 'total', total, 'atrasados', overdue_json, 'aguardando', waiting_json, 'alertas', alerts_json)
      );
    end if;
  end loop;
end;
$$ language plpgsql security definer;

-- 08:00 e 08:15 (horário de Brasília, UTC-3) todo dia.
select cron.schedule('fluxo-notify-overdue', '0 11 * * *', $$select fluxo_notify_overdue();$$);
select cron.schedule('fluxo-notify-daily-digest', '15 11 * * *', $$select fluxo_notify_daily_digest();$$);
