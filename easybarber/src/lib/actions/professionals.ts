"use server";

import { revalidatePath } from "next/cache";
import { requireMembership } from "@/lib/supabase/current-user";
import { runAction, type ActionResult } from "@/lib/actions/action-result";
import type { Database } from "@/lib/supabase/database.types";

export interface ProfessionalInput {
  name: string;
  phone?: string;
  roleTitle?: string;
  color?: string;
  serviceIds: string[];
}

function assertOwner(role: string) {
  if (role !== "owner") {
    throw new Error("Apenas o proprietário pode gerenciar profissionais.");
  }
}

export async function createProfessional(
  input: ProfessionalInput,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const { supabase, companyId, role } = await requireMembership();
    assertOwner(role);

    if (!input.name.trim()) throw new Error("Informe o nome do profissional.");

    const { data, error } = await supabase
      .from("professionals")
      .insert({
        company_id: companyId,
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        role_title: input.roleTitle?.trim() || "Barbeiro",
        color: input.color || "#FF6B1A",
      })
      .select("id")
      .single();

    if (error) throw error;

    if (input.serviceIds.length > 0) {
      const { error: linkError } = await supabase
        .from("professional_services")
        .insert(input.serviceIds.map((serviceId) => ({
          professional_id: data.id,
          service_id: serviceId,
        })));
      if (linkError) throw linkError;
    }

    revalidatePath("/profissionais");
    revalidatePath("/agenda/novo");
    return data;
  });
}

export async function updateProfessional(
  professionalId: string,
  input: Partial<Omit<ProfessionalInput, "serviceIds">> & {
    weeklyDaysOff?: number[];
    workStart?: string;
    workEnd?: string;
  },
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const { supabase, role } = await requireMembership();
    assertOwner(role);

    const patch: Database["public"]["Tables"]["professionals"]["Update"] = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.phone !== undefined) patch.phone = input.phone.trim() || null;
    if (input.roleTitle !== undefined) patch.role_title = input.roleTitle.trim();
    if (input.weeklyDaysOff !== undefined) patch.weekly_days_off = input.weeklyDaysOff;
    if (input.workStart !== undefined) patch.work_start = input.workStart;
    if (input.workEnd !== undefined) patch.work_end = input.workEnd;

    if (Object.keys(patch).length > 0) {
      const { error } = await supabase
        .from("professionals")
        .update(patch)
        .eq("id", professionalId);
      if (error) throw error;
    }

    revalidatePath("/profissionais");
    revalidatePath("/agenda/novo");
    return undefined;
  });
}

export async function setProfessionalServices(
  professionalId: string,
  serviceIds: string[],
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const { supabase, role } = await requireMembership();
    assertOwner(role);

    const { error: deleteError } = await supabase
      .from("professional_services")
      .delete()
      .eq("professional_id", professionalId);
    if (deleteError) throw deleteError;

    if (serviceIds.length > 0) {
      const { error: insertError } = await supabase
        .from("professional_services")
        .insert(serviceIds.map((serviceId) => ({
          professional_id: professionalId,
          service_id: serviceId,
        })));
      if (insertError) throw insertError;
    }

    revalidatePath("/profissionais");
    revalidatePath("/agenda/novo");
    return undefined;
  });
}

export interface ProfessionalBreakInput {
  startTime: string;
  endTime: string;
  label?: string;
}

export async function addProfessionalBreak(
  professionalId: string,
  input: ProfessionalBreakInput,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const { supabase, companyId, role } = await requireMembership();
    assertOwner(role);

    if (!input.startTime || !input.endTime) {
      throw new Error("Informe o início e o fim da pausa.");
    }
    if (input.startTime >= input.endTime) {
      throw new Error("O horário de início da pausa deve ser antes do horário de fim.");
    }

    const { data, error } = await supabase
      .from("professional_breaks")
      .insert({
        company_id: companyId,
        professional_id: professionalId,
        start_time: input.startTime,
        end_time: input.endTime,
        label: input.label?.trim() || null,
      })
      .select("id")
      .single();

    if (error) throw error;

    revalidatePath("/profissionais");
    revalidatePath("/agenda/novo");
    return data;
  });
}

export async function deleteProfessionalBreak(
  breakId: string,
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const { supabase, role } = await requireMembership();
    assertOwner(role);

    const { error } = await supabase
      .from("professional_breaks")
      .delete()
      .eq("id", breakId);

    if (error) throw error;

    revalidatePath("/profissionais");
    revalidatePath("/agenda/novo");
    return undefined;
  });
}

/**
 * Deletes a professional outright when it's safe to (no appointment
 * ever referenced them — appointments.professional_id is ON DELETE
 * RESTRICT, by design, so appointment history can never silently
 * disappear). When that FK blocks the delete, falls back to the
 * existing soft-delete (active = false) instead of surfacing a
 * confusing database error — from the owner's point of view the
 * professional is gone from their roster either way.
 */
export async function deleteProfessional(
  professionalId: string,
): Promise<ActionResult<{ fullyDeleted: boolean }>> {
  return runAction(async () => {
    const { supabase, role } = await requireMembership();
    assertOwner(role);

    const { error: deleteError } = await supabase
      .from("professionals")
      .delete()
      .eq("id", professionalId);

    if (!deleteError) {
      revalidatePath("/profissionais");
      revalidatePath("/agenda/novo");
      return { fullyDeleted: true };
    }

    if (deleteError.code !== "23503") throw deleteError;

    const { error: deactivateError } = await supabase
      .from("professionals")
      .update({ active: false })
      .eq("id", professionalId);
    if (deactivateError) throw deactivateError;

    revalidatePath("/profissionais");
    revalidatePath("/agenda/novo");
    return { fullyDeleted: false };
  });
}

const PHOTO_BUCKET = "professional-photos";
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

export async function uploadProfessionalPhoto(
  professionalId: string,
  formData: FormData,
): Promise<ActionResult<{ photoUrl: string }>> {
  return runAction(async () => {
    const { supabase, companyId, role } = await requireMembership();
    assertOwner(role);

    const file = formData.get("photo");
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("Selecione uma imagem.");
    }
    if (!file.type.startsWith("image/")) {
      throw new Error("Envie um arquivo de imagem (JPG, PNG, etc).");
    }
    if (file.size > MAX_PHOTO_BYTES) {
      throw new Error("A imagem deve ter até 3 MB.");
    }

    const { data: current } = await supabase
      .from("professionals")
      .select("photo_url")
      .eq("id", professionalId)
      .single();

    const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
    const path = `${companyId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);

    const { error: updateError } = await supabase
      .from("professionals")
      .update({ photo_url: urlData.publicUrl })
      .eq("id", professionalId);
    if (updateError) throw updateError;

    const previousPath = storagePathFromPublicUrl(current?.photo_url, PHOTO_BUCKET);
    if (previousPath) {
      await supabase.storage.from(PHOTO_BUCKET).remove([previousPath]);
    }

    revalidatePath("/profissionais");
    revalidatePath("/agenda");
    revalidatePath("/agenda/semana");
    revalidatePath("/agenda/novo");
    return { photoUrl: urlData.publicUrl };
  });
}

export async function removeProfessionalPhoto(
  professionalId: string,
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const { supabase, role } = await requireMembership();
    assertOwner(role);

    const { data: current } = await supabase
      .from("professionals")
      .select("photo_url")
      .eq("id", professionalId)
      .single();

    const { error } = await supabase
      .from("professionals")
      .update({ photo_url: null })
      .eq("id", professionalId);
    if (error) throw error;

    const previousPath = storagePathFromPublicUrl(current?.photo_url, PHOTO_BUCKET);
    if (previousPath) {
      await supabase.storage.from(PHOTO_BUCKET).remove([previousPath]);
    }

    revalidatePath("/profissionais");
    revalidatePath("/agenda");
    revalidatePath("/agenda/semana");
    revalidatePath("/agenda/novo");
    return undefined;
  });
}

/** Extracts "<companyId>/<file>" back out of a Supabase Storage public URL, for cleanup. */
function storagePathFromPublicUrl(url: string | null | undefined, bucket: string): string | null {
  if (!url) return null;
  const marker = `/object/public/${bucket}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return url.slice(index + marker.length);
}
