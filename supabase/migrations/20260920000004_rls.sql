alter table place enable row level security;
alter table phenomenon enable row level security;
alter table phenomenon_i18n enable row level security;
alter table place_i18n enable row level security;
alter table phenomenon_place enable row level security;
alter table source enable row level security;
alter table phenomenon_source enable row level security;
alter table rule enable row level security;
alter table rule_materialization enable row level security;
alter table occurrence enable row level security;
alter table landing_page enable row level security;
alter table slug_redirect enable row level security;
alter table provider enable row level security;
alter table supplier enable row level security;
alter table place_external_ref enable row level security;
alter table booking_offer enable row level security;
alter table offer_phenomenon enable row level security;
alter table offer_availability enable row level security;
alter table affiliate_click enable row level security;
alter table conversion enable row level security;
alter table booking enable row level security;
alter table fx_rate enable row level security;
alter table profile enable row level security;
alter table device enable row level security;
alter table trip enable row level security;
alter table trip_leg enable row level security;
alter table trip_item enable row level security;
alter table save enable row level security;
alter table alert enable row level security;
alter table contribution enable row level security;
alter table report enable row level security;
alter table config enable row level security;
alter table event enable row level security;

-- Catalog is public-read when published. Writes go through service_role.
create policy place_public_read on place
  for select using (status = 'published' and deleted_at is null);
create policy phenomenon_public_read on phenomenon
  for select using (status = 'published' and deleted_at is null);
create policy phenomenon_place_public_read on phenomenon_place
  for select using (status = 'published');
create policy source_public_read on source for select using (true);
create policy phenomenon_source_public_read on phenomenon_source for select using (true);
create policy landing_page_public_read on landing_page for select using (true);
create policy slug_redirect_public_read on slug_redirect for select using (true);
create policy provider_public_read on provider for select using (true);
create policy supplier_public_read on supplier for select using (true);
create policy place_external_ref_public_read on place_external_ref for select using (true);
create policy booking_offer_public_read on booking_offer
  for select using (active and deleted_at is null);
create policy offer_phenomenon_public_read on offer_phenomenon for select using (true);
create policy fx_rate_public_read on fx_rate for select using (true);
create policy config_public_read on config for select using (true);
create policy phenomenon_i18n_public_read on phenomenon_i18n for select using (true);
create policy place_i18n_public_read on place_i18n for select using (true);

-- Occurrence is not directly selectable by anon; force the explore() RPC.
revoke select on occurrence from anon, authenticated;
revoke select on rule from anon, authenticated;
revoke select on rule_materialization from anon, authenticated;

create policy occurrence_service_read on occurrence
  for select to service_role using (true);

create policy affiliate_click_insert on affiliate_click
  for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));

create policy event_insert on event
  for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));

create policy profile_own on profile
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy device_own on device
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy trip_own on trip
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy trip_leg_own on trip_leg
  for all to authenticated
  using (exists (
    select 1 from trip t
    where t.id = trip_id and t.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from trip t
    where t.id = trip_id and t.owner_id = (select auth.uid())
  ));

create policy trip_item_own on trip_item
  for all to authenticated
  using (exists (
    select 1 from trip t
    where t.id = trip_id and t.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from trip t
    where t.id = trip_id and t.owner_id = (select auth.uid())
  ));

create policy save_own on save
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy alert_own on alert
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy contribution_own on contribution
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy report_own on report
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy booking_own on booking
  for select to authenticated
  using ((select auth.uid()) = user_id);

grant execute on function explore(double precision, double precision, double precision, timestamptz, timestamptz, family[], text[]) to anon, authenticated;
grant execute on function get_shared_trip(text) to anon, authenticated;
grant execute on function rank_score(tstzrange, tstzrange, numeric, double precision, double precision, timestamptz, text[], text[], smallint) to anon, authenticated;
grant execute on function peak_proximity(timestamptz, tstzrange, tstzrange) to anon, authenticated;
grant execute on function travel_band(double precision, double precision) to anon, authenticated;
