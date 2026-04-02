import {
  buildInFilter,
  createActivityLog,
  createNotification,
  ensureProfile,
  getAuthContext,
  requireAuth,
  restWrite,
  safeSelect,
  safeSingle,
  syncProfileCache,
  unique
} from "./core.js";
import { getSiteCatalog } from "./catalog.js";
import { loadHydratedBookingsByQuery } from "./bookings.js";

function sortByDate(list = [], field = "created_at", direction = "desc") {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...list].sort((left, right) => String(left?.[field] || "").localeCompare(String(right?.[field] || "")) * multiplier);
}

function groupBy(list = [], key) {
  return list.reduce((map, item) => {
    const value = typeof key === "function" ? key(item) : item?.[key];
    if (value == null) return map;
    const bucket = map.get(value) || [];
    bucket.push(item);
    map.set(value, bucket);
    return map;
  }, new Map());
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function sortAddresses(addressRows = []) {
  return [...addressRows].sort((left, right) => {
    const defaultDelta = Number(Boolean(right?.is_default)) - Number(Boolean(left?.is_default));
    if (defaultDelta !== 0) return defaultDelta;
    return String(right?.updated_at || right?.created_at || "").localeCompare(String(left?.updated_at || left?.created_at || ""));
  });
}

function normalizeSavedTravelerPayload(payload = {}) {
  const fullName = String(payload.fullName || "").trim();
  const email = String(payload.email || "").trim();
  const travelerType = ["adult", "child", "infant"].includes(String(payload.travelerType || ""))
    ? String(payload.travelerType)
    : "adult";

  if (!fullName) {
    throw new Error("Hành khách lưu sẵn cần có họ tên.");
  }
  if (email && !isValidEmail(email)) {
    throw new Error("Email hành khách không hợp lệ.");
  }

  return {
    full_name: fullName,
    phone: String(payload.phone || "").trim() || null,
    email: email || null,
    date_of_birth: String(payload.dateOfBirth || "").trim() || null,
    gender: String(payload.gender || "").trim() || null,
    id_number: String(payload.idNumber || "").trim() || null,
    passport_number: String(payload.passportNumber || "").trim() || null,
    nationality: String(payload.nationality || "").trim() || null,
    traveler_type: travelerType,
    notes: String(payload.notes || "").trim() || null
  };
}

function normalizeAddressPayload(payload = {}) {
  const fullName = String(payload.fullName || "").trim();
  const phone = String(payload.phone || "").trim();
  const addressLine = String(payload.addressLine || "").trim();

  if (!fullName || !phone || !addressLine) {
    throw new Error("Địa chỉ nhận thông tin cần có người nhận, số điện thoại và địa chỉ chi tiết.");
  }

  return {
    label: String(payload.label || "").trim() || null,
    full_name: fullName,
    phone,
    address_line: addressLine,
    province: String(payload.province || "").trim() || null,
    district: String(payload.district || "").trim() || null,
    ward: String(payload.ward || "").trim() || null,
    postal_code: String(payload.postalCode || "").trim() || null,
    country_code: String(payload.countryCode || "VN").trim() || "VN"
  };
}

function hydrateAccountTickets(ticketRows, ticketMessageRows, bookingsById, profileMap) {
  const messageMap = groupBy(ticketMessageRows, "ticket_id");
  return sortByDate(ticketRows, "updated_at", "desc").map((ticket) => {
    const booking = bookingsById.get(ticket.booking_id) || null;
    const customer = profileMap.get(ticket.user_id) || null;
    const assignee = profileMap.get(ticket.assigned_to) || null;
    return {
      ...ticket,
      booking,
      bookingCode: booking?.booking_code || null,
      customerName: customer?.full_name || customer?.email || booking?.contact_name || "Khách hàng",
      assignedToName: assignee?.full_name || assignee?.email || (ticket.assigned_to ? "Staff" : "Chưa phân công"),
      tour: booking?.tour || null,
      messages: sortByDate(messageMap.get(ticket.id) || [], "created_at", "asc").map((message) => ({
        ...message,
        senderName: profileMap.get(message.sender_id)?.full_name || profileMap.get(message.sender_id)?.email || message.sender_type
      }))
    };
  });
}

async function clearDefaultAddresses(userId, excludedId = null) {
  const query = {
    user_id: `eq.${userId}`,
    is_default: "eq.true",
    select: "id"
  };
  if (excludedId) {
    query.id = `neq.${excludedId}`;
  }

  await restWrite("user_addresses", {
    method: "PATCH",
    query,
    body: {
      is_default: false
    }
  });
}

export async function toggleWishlist(tourId) {
  const auth = requireAuth(await getAuthContext(), "Bạn cần đăng nhập để lưu wishlist.");

  const existingRow = await safeSingle("wishlist", {
    select: "id,tour_id",
    user_id: `eq.${auth.user.id}`,
    tour_id: `eq.${tourId}`
  });

  if (existingRow?.id) {
    await restWrite("wishlist", {
      method: "DELETE",
      query: { id: `eq.${existingRow.id}` },
      headers: { Prefer: "return=minimal" }
    });

    const nextWishlistIds = (auth.profile?.wishlistTourIds || []).filter((id) => id !== tourId);
    ensureProfile(auth.user, { wishlistTourIds: nextWishlistIds, roles: auth.roles });
    return { active: false };
  }

  await restWrite("wishlist", {
    method: "POST",
    query: { select: "*" },
    body: {
      user_id: auth.user.id,
      tour_id: tourId
    }
  });

  await createNotification({
    userId: auth.user.id,
    title: "Đã thêm tour vào wishlist",
    content: "Tour này đã được lưu để bạn xem lại ở mọi thiết bị.",
    notificationType: "wishlist",
    referenceType: "tour",
    referenceId: tourId
  });

  const nextWishlistIds = unique([...(auth.profile?.wishlistTourIds || []), tourId]);
  ensureProfile(auth.user, { wishlistTourIds: nextWishlistIds, roles: auth.roles });
  return { active: true };
}

export async function getAccountDashboard() {
  const auth = requireAuth(await getAuthContext(), "Bạn cần đăng nhập để xem tài khoản.");
  const catalog = await getSiteCatalog();
  const [wishlistRows, bookings, notificationRows, savedTravelerRows, addressRows, ticketRows] = await Promise.all([
    safeSelect("wishlist", {
      select: "tour_id,created_at",
      user_id: `eq.${auth.user.id}`,
      order: "created_at.desc"
    }),
    loadHydratedBookingsByQuery({ user_id: `eq.${auth.user.id}`, order: "created_at.desc" }, catalog),
    safeSelect("notifications", {
      select: "id,title,content,notification_type,reference_type,reference_id,is_read,read_at,created_at",
      user_id: `eq.${auth.user.id}`,
      order: "created_at.desc"
    }),
    safeSelect("saved_travelers", {
      select: "*",
      user_id: `eq.${auth.user.id}`,
      order: "updated_at.desc"
    }),
    safeSelect("user_addresses", {
      select: "*",
      user_id: `eq.${auth.user.id}`,
      order: "updated_at.desc"
    }),
    safeSelect("support_tickets", {
      select: "*",
      user_id: `eq.${auth.user.id}`,
      order: "updated_at.desc"
    })
  ]);

  const ticketIds = ticketRows.map((ticket) => ticket.id).filter(Boolean);
  const profileIds = [
    ...ticketRows.map((ticket) => ticket.user_id),
    ...ticketRows.map((ticket) => ticket.assigned_to)
  ].filter(Boolean);

  const ticketMessageRows = ticketIds.length
    ? await safeSelect("support_ticket_messages", {
        select: "*",
        ticket_id: buildInFilter(ticketIds),
        order: "created_at.asc"
      })
    : [];
  const profileRows = profileIds.length || ticketMessageRows.length
    ? await safeSelect("profiles", {
        select: "id,email,full_name,avatar_url",
        id: buildInFilter(unique([
          ...profileIds,
          ...ticketMessageRows.map((message) => message.sender_id)
        ].filter(Boolean)))
      })
    : [];

  const bookingsById = new Map(bookings.map((booking) => [booking.id, booking]));
  const profileMap = new Map(profileRows.map((profile) => [profile.id, profile]));
  const wishlistIds = unique(wishlistRows.map((item) => item.tour_id));
  const notifications = sortByDate(notificationRows, "created_at", "desc");
  const tickets = hydrateAccountTickets(ticketRows, ticketMessageRows, bookingsById, profileMap);

  ensureProfile(auth.user, {
    email: auth.profile?.email || auth.user.email || "",
    full_name: auth.profile?.full_name || auth.user.user_metadata?.full_name || "",
    phone: auth.profile?.phone || "",
    avatar_url: auth.profile?.avatar_url || auth.user.user_metadata?.avatar_url || "",
    address: auth.profile?.address || "",
    customer_level: auth.profile?.customer_level || "regular",
    status: auth.profile?.status || "active",
    wishlistTourIds: wishlistIds,
    roles: auth.roles
  });

  return {
    user: auth.user,
    profile: { ...auth.profile, wishlistTourIds: wishlistIds },
    roles: auth.roles,
    primaryRole: auth.primaryRole,
    bookings,
    wishlistTours: catalog.tours.filter((tour) => wishlistIds.includes(tour.id)),
    notifications,
    tickets,
    savedTravelers: sortByDate(savedTravelerRows, "updated_at", "desc"),
    addresses: sortAddresses(addressRows)
  };
}

export async function updateProfile(payload) {
  const auth = requireAuth(await getAuthContext(), "Bạn cần đăng nhập để cập nhật hồ sơ.");

  const rows = await restWrite("profiles", {
    method: "PATCH",
    query: {
      id: `eq.${auth.user.id}`,
      select: "id,email,full_name,phone,avatar_url,address,status,customer_level,created_at,updated_at"
    },
    body: {
      full_name: String(payload?.fullName || auth.profile?.full_name || "").trim() || null,
      phone: String(payload?.phone || auth.profile?.phone || "").trim() || null,
      avatar_url: String(payload?.avatarUrl || auth.profile?.avatar_url || "").trim() || null,
      address: String(payload?.address || auth.profile?.address || "").trim() || null
    }
  });

  return syncProfileCache(auth.user, rows?.[0] || null, auth.roles);
}

export async function markNotificationRead(notificationIdOrPayload = null) {
  const auth = requireAuth(await getAuthContext(), "Bạn cần đăng nhập để cập nhật thông báo.");
  const payload = notificationIdOrPayload && typeof notificationIdOrPayload === "object"
    ? {
        notificationId: notificationIdOrPayload.notificationId || notificationIdOrPayload.id || null,
        all: Boolean(notificationIdOrPayload.all)
      }
    : {
        notificationId: notificationIdOrPayload,
        all: notificationIdOrPayload === "all"
      };
  const now = new Date().toISOString();

  if (payload.all) {
    await restWrite("notifications", {
      method: "PATCH",
      query: {
        user_id: `eq.${auth.user.id}`,
        is_read: "eq.false",
        select: "id"
      },
      body: {
        is_read: true,
        read_at: now
      }
    });
    return { updated: true, all: true };
  }

  if (!payload.notificationId) {
    throw new Error("Thiếu thông báo cần cập nhật.");
  }

  const notification = await safeSingle("notifications", {
    select: "id,user_id,is_read",
    id: `eq.${payload.notificationId}`,
    user_id: `eq.${auth.user.id}`
  });
  if (!notification?.id) {
    throw new Error("Không tìm thấy thông báo này.");
  }
  if (notification.is_read) {
    return notification;
  }

  const rows = await restWrite("notifications", {
    method: "PATCH",
    query: {
      id: `eq.${notification.id}`,
      user_id: `eq.${auth.user.id}`,
      select: "*"
    },
    body: {
      is_read: true,
      read_at: now
    }
  });

  return rows?.[0] || notification;
}

export async function saveSavedTraveler(payload = {}) {
  const auth = requireAuth(await getAuthContext(), "Bạn cần đăng nhập để lưu hành khách.");
  const normalized = normalizeSavedTravelerPayload(payload);
  const travelerId = String(payload.id || payload.travelerId || "").trim() || null;

  if (travelerId) {
    const existing = await safeSingle("saved_travelers", {
      select: "*",
      id: `eq.${travelerId}`,
      user_id: `eq.${auth.user.id}`
    });
    if (!existing?.id) {
      throw new Error("Không tìm thấy hành khách lưu sẵn.");
    }

    const rows = await restWrite("saved_travelers", {
      method: "PATCH",
      query: {
        id: `eq.${existing.id}`,
        user_id: `eq.${auth.user.id}`,
        select: "*"
      },
      body: normalized
    });

    await createActivityLog({
      actorId: auth.user.id,
      action: "saved_traveler_updated",
      entityType: "saved_traveler",
      entityId: existing.id,
      oldData: { full_name: existing.full_name, traveler_type: existing.traveler_type },
      newData: { full_name: normalized.full_name, traveler_type: normalized.traveler_type }
    });

    return rows?.[0] || existing;
  }

  const rows = await restWrite("saved_travelers", {
    method: "POST",
    query: { select: "*" },
    body: {
      user_id: auth.user.id,
      ...normalized
    }
  });

  await createActivityLog({
    actorId: auth.user.id,
    action: "saved_traveler_created",
    entityType: "saved_traveler",
    entityId: rows?.[0]?.id || null,
    newData: { full_name: normalized.full_name, traveler_type: normalized.traveler_type }
  });

  return rows?.[0] || null;
}

export async function deleteSavedTraveler(travelerId) {
  const auth = requireAuth(await getAuthContext(), "Bạn cần đăng nhập để xóa hành khách.");
  const existing = await safeSingle("saved_travelers", {
    select: "*",
    id: `eq.${travelerId}`,
    user_id: `eq.${auth.user.id}`
  });
  if (!existing?.id) {
    throw new Error("Không tìm thấy hành khách lưu sẵn.");
  }

  await restWrite("saved_travelers", {
    method: "DELETE",
    query: {
      id: `eq.${existing.id}`,
      user_id: `eq.${auth.user.id}`
    },
    headers: { Prefer: "return=minimal" }
  });

  await createActivityLog({
    actorId: auth.user.id,
    action: "saved_traveler_deleted",
    entityType: "saved_traveler",
    entityId: existing.id,
    oldData: { full_name: existing.full_name, traveler_type: existing.traveler_type }
  });

  return { deleted: true };
}

export async function saveUserAddress(payload = {}) {
  const auth = requireAuth(await getAuthContext(), "Bạn cần đăng nhập để lưu địa chỉ.");
  const normalized = normalizeAddressPayload(payload);
  const addressId = String(payload.id || payload.addressId || "").trim() || null;
  const existingAddresses = await safeSelect("user_addresses", {
    select: "id,is_default,updated_at,created_at",
    user_id: `eq.${auth.user.id}`,
    order: "updated_at.desc"
  });
  const shouldBeDefault = Boolean(payload.isDefault) || existingAddresses.length === 0;

  if (shouldBeDefault) {
    await clearDefaultAddresses(auth.user.id, addressId);
  }

  if (addressId) {
    const existing = await safeSingle("user_addresses", {
      select: "*",
      id: `eq.${addressId}`,
      user_id: `eq.${auth.user.id}`
    });
    if (!existing?.id) {
      throw new Error("Không tìm thấy địa chỉ đã lưu.");
    }

    const rows = await restWrite("user_addresses", {
      method: "PATCH",
      query: {
        id: `eq.${existing.id}`,
        user_id: `eq.${auth.user.id}`,
        select: "*"
      },
      body: {
        ...normalized,
        is_default: shouldBeDefault ? true : Boolean(existing.is_default && existingAddresses.length === 1)
      }
    });

    await createActivityLog({
      actorId: auth.user.id,
      action: "user_address_updated",
      entityType: "user_address",
      entityId: existing.id,
      oldData: { full_name: existing.full_name, label: existing.label, is_default: existing.is_default },
      newData: { full_name: normalized.full_name, label: normalized.label, is_default: shouldBeDefault }
    });

    return rows?.[0] || existing;
  }

  const rows = await restWrite("user_addresses", {
    method: "POST",
    query: { select: "*" },
    body: {
      user_id: auth.user.id,
      ...normalized,
      is_default: shouldBeDefault
    }
  });

  await createActivityLog({
    actorId: auth.user.id,
    action: "user_address_created",
    entityType: "user_address",
    entityId: rows?.[0]?.id || null,
    newData: { full_name: normalized.full_name, label: normalized.label, is_default: shouldBeDefault }
  });

  return rows?.[0] || null;
}

export async function deleteUserAddress(addressId) {
  const auth = requireAuth(await getAuthContext(), "Bạn cần đăng nhập để xóa địa chỉ.");
  const existing = await safeSingle("user_addresses", {
    select: "*",
    id: `eq.${addressId}`,
    user_id: `eq.${auth.user.id}`
  });
  if (!existing?.id) {
    throw new Error("Không tìm thấy địa chỉ đã lưu.");
  }

  await restWrite("user_addresses", {
    method: "DELETE",
    query: {
      id: `eq.${existing.id}`,
      user_id: `eq.${auth.user.id}`
    },
    headers: { Prefer: "return=minimal" }
  });

  if (existing.is_default) {
    const remaining = await safeSelect("user_addresses", {
      select: "id,is_default,updated_at,created_at",
      user_id: `eq.${auth.user.id}`,
      order: "updated_at.desc"
    });
    const fallback = sortAddresses(remaining)[0] || null;
    if (fallback?.id) {
      await clearDefaultAddresses(auth.user.id, fallback.id);
      await restWrite("user_addresses", {
        method: "PATCH",
        query: {
          id: `eq.${fallback.id}`,
          user_id: `eq.${auth.user.id}`,
          select: "*"
        },
        body: {
          is_default: true
        }
      });
    }
  }

  await createActivityLog({
    actorId: auth.user.id,
    action: "user_address_deleted",
    entityType: "user_address",
    entityId: existing.id,
    oldData: { full_name: existing.full_name, label: existing.label, is_default: existing.is_default }
  });

  return { deleted: true };
}



