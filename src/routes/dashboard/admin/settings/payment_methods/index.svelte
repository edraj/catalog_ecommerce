<script lang="ts">
  import { onMount } from "svelte";
  import { ResourceType } from "@edraj/tsdmart";
  import PaymentMethodForm from "@/components/forms/PaymentMethodForm.svelte";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { _ } from "@/i18n";
  import {
    getSpaceContents,
    createPaymentMethod,
    updatePaymentMethod,
    deleteEntity,
  } from "@/lib/dmart_services";
  import {website} from "@/config";

  let paymentMethods = $state([]);
  let isLoading = $state(true);
  let showModal = $state(false);
  let isEditing = $state(false);
  let isSaving = $state(false);
  let formData: any = $state({});
  let validateFn = $state(() => true);
  let currentPaymentMethod = $state(null);
  let showDeleteConfirm = $state(false);
  let paymentMethodToDelete = $state(null);
  let isDeleting = $state(false);

  onMount(async () => {
    await loadPaymentMethods();
  });

  async function loadPaymentMethods() {
    isLoading = true;
    try {
      const response: any = await getSpaceContents(
        website.main_space,
        "/settings/payment_methods",
        "managed",
        100,
        0,
        true
      );

      if (response && response.records) {
        // Sort by order field
        paymentMethods = response.records.sort((a, b) => {
          const orderA = a.attributes?.payload?.body?.payload?.body?.order || 0;
          const orderB = b.attributes?.payload?.body?.payload?.body?.order || 0;
          return orderA - orderB;
        });
        successToastMessage(
          $_("paymentMethods.loaded", {
            values: { count: paymentMethods.length },
          })
        );
      }
    } catch (error) {
      console.error("Failed to load payment methods:", error);
      errorToastMessage($_("paymentMethods.loadFailed"));
    } finally {
      isLoading = false;
    }
  }

  function openCreateModal() {
    formData = {
      shortname: "",
      displayname: { en: "", ar: "", ku: "" },
      description: { en: "", ar: "", ku: "" },
      order: 0,
      is_active: true,
    };
    isEditing = false;
    currentPaymentMethod = null;
    showModal = true;
  }

  function openEditModal(paymentMethod: any) {
    const nestedPayload = paymentMethod.attributes?.payload?.body || {};
    formData = {
      shortname: paymentMethod.shortname,
      displayname: nestedPayload.displayname || { en: "", ar: "", ku: "" },
      description: nestedPayload.description || { en: "", ar: "", ku: "" },
      order: nestedPayload.payload?.body?.order || 0,
      is_active: nestedPayload.is_active ?? true,
    };
    isEditing = true;
    currentPaymentMethod = paymentMethod;
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    formData = {};
    currentPaymentMethod = null;
  }

  async function savePaymentMethod() {
    if (!validateFn()) {
      errorToastMessage($_("validation.fixErrors"));
      return;
    }

    isSaving = true;
    try {
      const result = isEditing
        ? await updatePaymentMethod(website.main_space, formData)
        : await createPaymentMethod(website.main_space, formData);

      if (result) {
        successToastMessage(
          isEditing
            ? $_("paymentMethods.updated")
            : $_("paymentMethods.created")
        );
        closeModal();
        await loadPaymentMethods();
      } else {
        errorToastMessage($_("paymentMethods.saveFailed"));
      }
    } catch (error) {
      console.error("Failed to save payment method:", error);
      errorToastMessage($_("paymentMethods.saveFailed"));
    } finally {
      isSaving = false;
    }
  }

  function openDeleteConfirm(paymentMethod: any) {
    paymentMethodToDelete = paymentMethod;
    showDeleteConfirm = true;
  }

  function closeDeleteConfirm() {
    showDeleteConfirm = false;
    paymentMethodToDelete = null;
  }

  async function deletePaymentMethod() {
    if (!paymentMethodToDelete) return;

    isDeleting = true;
    try {
      await deleteEntity(
        paymentMethodToDelete.shortname,
        website.main_space,
        "/settings/payment_methods",
        ResourceType.content
      );

      successToastMessage($_("paymentMethods.deleted"));
      closeDeleteConfirm();
      await loadPaymentMethods();
    } catch (error) {
      console.error("Failed to delete payment method:", error);
      errorToastMessage($_("paymentMethods.deleteFailed"));
    } finally {
      isDeleting = false;
    }
  }
</script>

<div class="payment-methods-page">
  <div class="page-header">
    <h1 class="page-title">{$_("paymentMethods.title")}</h1>
    <button class="btn btn-primary" onclick={openCreateModal}>
      {$_("paymentMethods.createNew")}
    </button>
  </div>

  {#if isLoading}
    <div class="loading">
      <div class="spinner"></div>
      <p>{$_("common.loading")}</p>
    </div>
  {:else}
    <div class="payment-methods-grid">
      {#each paymentMethods as paymentMethod}
        {@const nestedPayload = paymentMethod.attributes?.payload?.body || {}}
        <div class="payment-method-card">
          <div class="payment-method-header">
            <h3 class="payment-method-name">
              {nestedPayload.displayname?.en || paymentMethod.shortname}
            </h3>
            <div
              class="payment-method-badge"
              class:active={nestedPayload.is_active}
            >
              {nestedPayload.is_active
                ? $_("common.active")
                : $_("common.inactive")}
            </div>
          </div>

          <div class="meta-shortname">{paymentMethod.shortname}</div>

          <div class="payment-method-info">
            <div class="info-item">
              <span class="info-label">{$_("paymentMethod.order")}:</span>
              <span class="info-value">
                {nestedPayload.payload?.body?.order ?? 0}
              </span>
            </div>

            {#if nestedPayload.displayname?.ar}
              <div class="info-item">
                <span class="info-label">{$_("paymentMethod.arabicName")}:</span
                >
                <span class="info-value">{nestedPayload.displayname.ar}</span>
              </div>
            {/if}

            {#if nestedPayload.displayname?.ku}
              <div class="info-item">
                <span class="info-label"
                  >{$_("paymentMethod.kurdishName")}:</span
                >
                <span class="info-value">{nestedPayload.displayname.ku}</span>
              </div>
            {/if}
          </div>

          <div class="payment-method-actions">
            <button
              class="btn btn-sm btn-secondary"
              onclick={() => openEditModal(paymentMethod)}
            >
              {$_("common.edit")}
            </button>
            <button
              class="btn btn-sm btn-danger"
              onclick={() => openDeleteConfirm(paymentMethod)}
            >
              {$_("common.delete")}
            </button>
          </div>
        </div>
      {/each}

      {#if paymentMethods.length === 0}
        <div class="empty-state">
          <p>{$_("paymentMethods.noPaymentMethods")}</p>
          <button class="btn btn-primary" onclick={openCreateModal}>
            {$_("paymentMethods.createFirst")}
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>

{#if showModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={closeModal}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>
          {isEditing
            ? $_("paymentMethods.editPaymentMethod")
            : $_("paymentMethods.createPaymentMethod")}
        </h2>
        <button class="modal-close" onclick={closeModal}>×</button>
      </div>
      <div class="modal-body">
        <PaymentMethodForm bind:formData bind:validateFn />
      </div>
      <div class="modal-footer">
        <button
          class="btn btn-secondary"
          onclick={closeModal}
          disabled={isSaving}
        >
          {$_("common.cancel")}
        </button>
        <button
          class="btn btn-primary"
          onclick={savePaymentMethod}
          disabled={isSaving}
        >
          {isSaving ? $_("common.saving") : $_("common.save")}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showDeleteConfirm}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={closeDeleteConfirm}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal modal-sm" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>{$_("paymentMethods.deleteConfirm")}</h2>
        <button class="modal-close" onclick={closeDeleteConfirm}>×</button>
      </div>
      <div class="modal-body">
        <p>
          {$_("paymentMethods.deleteMessage", {
            values: { name: paymentMethodToDelete?.shortname },
          })}
        </p>
      </div>
      <div class="modal-footer">
        <button
          class="btn btn-secondary"
          onclick={closeDeleteConfirm}
          disabled={isDeleting}
        >
          {$_("common.cancel")}
        </button>
        <button
          class="btn btn-danger"
          onclick={deletePaymentMethod}
          disabled={isDeleting}
        >
          {isDeleting ? $_("common.deleting") : $_("common.delete")}
        </button>
      </div>
    </div>
  </div>
{/if}

<style src="./payment_methods.css"></style>
