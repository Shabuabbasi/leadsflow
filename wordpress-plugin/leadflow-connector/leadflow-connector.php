<?php
/**
 * Plugin Name: LeadFlow Connector
 * Description: Captures leads via [leadflow_form] shortcode, saves locally, and syncs to Node.js API.
 * Version: 1.0.0
 */

if (!defined('ABSPATH')) exit;

// 1. Custom Post Type for Leads Storage
function lfc_register_cpt() {
    register_post_type('lfc_lead', [
        'labels' => [
            'name'          => 'LeadFlow Leads',
            'singular_name' => 'Lead',
            'menu_name'     => 'LeadFlow CRM',
        ],
        'public'       => false,
        'show_ui'      => true,
        'menu_icon'    => 'dashicons-id',
        'supports'     => ['title'],
    ]);
}
add_action('init', 'lfc_register_cpt');

// 2. Admin Settings Page (Configurable API URL & Secret Token)
function lfc_add_admin_menu() {
    add_submenu_page(
        'edit.php?post_type=lfc_lead',
        'LeadFlow Settings',
        'API Settings',
        'manage_options',
        'lfc-settings',
        'lfc_render_settings_page'
    );
}
add_action('admin_menu', 'lfc_add_admin_menu');

function lfc_render_settings_page() {
    if (isset($_POST['lfc_save_settings']) && check_admin_referer('lfc_settings_nonce')) {
        update_option('lfc_api_url', sanitize_text_field($_POST['lfc_api_url']));
        update_option('lfc_api_secret', sanitize_text_field($_POST['lfc_api_secret']));
        echo '<div class="updated"><p>Settings saved successfully!</p></div>';
    }

    $api_url = get_option('lfc_api_url', 'http://localhost:5000/api/leads');
    $api_secret = get_option('lfc_api_secret', 'my_jwt_or_secret_token');
    ?>
    <div class="wrap">
        <h2>LeadFlow Connector Settings</h2>
        <form method="POST">
            <?php wp_nonce_field('lfc_settings_nonce'); ?>
            <table class="form-table">
                <tr>
                    <th><label>Node.js API URL</label></th>
                    <td><input type="url" name="lfc_api_url" value="<?php echo esc_attr($api_url); ?>" class="regular-text" required></td>
                </tr>
                <tr>
                    <th><label>API Secret / Bearer Token</label></th>
                    <td><input type="text" name="lfc_api_secret" value="<?php echo esc_attr($api_secret); ?>" class="regular-text" required></td>
                </tr>
            </table>
            <button type="submit" name="lfc_save_settings" class="button button-primary">Save Settings</button>
        </form>
    </div>
    <?php
}

// 3. Custom Admin Columns to Show Sync Status
function lfc_set_custom_columns($columns) {
    $columns['email'] = 'Email';
    $columns['phone'] = 'Phone';
    $columns['service'] = 'Service';
    $columns['sync_status'] = 'API Sync Status';
    return $columns;
}
add_filter('manage_lfc_lead_posts_columns', 'lfc_set_custom_columns');

function lfc_custom_column_data($column, $post_id) {
    switch ($column) {
        case 'email':
            echo esc_html(get_post_meta($post_id, '_lfc_email', true));
            break;
        case 'phone':
            echo esc_html(get_post_meta($post_id, '_lfc_phone', true));
            break;
        case 'service':
            echo esc_html(get_post_meta($post_id, '_lfc_service', true));
            break;
        case 'sync_status':
            $status = get_post_meta($post_id, '_lfc_sync_status', true);
            if ($status === 'Succeeded') {
                echo '<span style="color:green; font-weight:bold;">✔ Succeeded</span>';
            } else {
                $err = get_post_meta($post_id, '_lfc_sync_error', true);
                echo '<span style="color:red; font-weight:bold;">✖ Failed</span> (' . esc_html($err ?: 'Unknown') . ')';
            }
            break;
    }
}
add_action('manage_lfc_lead_posts_custom_column', 'lfc_custom_column_data', 10, 2);

// 4. Lead Form Shortcode [leadflow_form]
function lfc_render_form() {
    ob_start();
    $message_output = '';

    if (isset($_POST['lfc_submit_lead'])) {
        $message_output = lfc_process_submission();
    }
    ?>
    <div style="max-width: 500px; margin: 20px 0; padding: 20px; border: 1px solid #ccc; border-radius: 8px;">
        <?php echo $message_output; ?>
        <form method="POST" action="">
            <?php wp_nonce_field('lfc_form_nonce_action', 'lfc_form_nonce'); ?>
            <p>
                <label>Full Name *</label><br>
                <input type="text" name="lfc_name" required style="width: 100%;">
            </p>
            <p>
                <label>Email Address *</label><br>
                <input type="email" name="lfc_email" required style="width: 100%;">
            </p>
            <p>
                <label>Phone Number *</label><br>
                <input type="tel" name="lfc_phone" required style="width: 100%;">
            </p>
            <p>
                <label>Service *</label><br>
                <select name="lfc_service" required style="width: 100%;">
                    <option value="">-- Select Service --</option>
                    <option value="Web Development">Web Development</option>
                    <option value="UI/UX Design">UI/UX Design</option>
                    <option value="Digital Marketing">Digital Marketing</option>
                </select>
            </p>
            <p>
                <label>Budget Range *</label><br>
                <select name="lfc_budget" required style="width: 100%;">
                    <option value="">-- Select Budget --</option>
                    <option value="$500 - $1000">$500 - $1000</option>
                    <option value="$1000 - $5000">$1000 - $5000</option>
                    <option value="$5000+">$5000+</option>
                </select>
            </p>
            <p>
                <label>Message *</label><br>
                <textarea name="lfc_message" required style="width: 100%; height: 80px;"></textarea>
            </p>
            <button type="submit" name="lfc_submit_lead" style="padding: 10px 20px; background: #0073aa; color: #fff; border: none; cursor: pointer;">Submit Lead</button>
        </form>
    </div>
    <?php
    return ob_get_clean();
}
add_shortcode('leadflow_form', 'lfc_render_form');

// 5. Server-side Validation, Local DB Saving & API Syncing
function lfc_process_submission() {
    // Nonce Check
    if (!isset($_POST['lfc_form_nonce']) || !wp_verify_nonce($_POST['lfc_form_nonce'], 'lfc_form_nonce_action')) {
        return '<p style="color:red;">Security check failed!</p>';
    }

    // Sanitization
    $name    = sanitize_text_field($_POST['lfc_name']);
    $email   = sanitize_email($_POST['lfc_email']);
    $phone   = sanitize_text_field($_POST['lfc_phone']);
    $service = sanitize_text_field($_POST['lfc_service']);
    $budget  = sanitize_text_field($_POST['lfc_budget']);
    $message = sanitize_textarea_field($_POST['lfc_message']);

    // Server-side Email Validation
    if (!is_email($email)) {
        return '<p style="color:red;">Invalid email address provided.</p>';
    }

    // Save to Local WordPress CPT
    $post_id = wp_insert_post([
        'post_title'  => $name,
        'post_type'   => 'lfc_lead',
        'post_status' => 'publish',
    ]);

    if (!$post_id || is_wp_error($post_id)) {
        return '<p style="color:red;">Failed to store lead locally.</p>';
    }

    // Save Lead Meta Data
    update_post_meta($post_id, '_lfc_email', $email);
    update_post_meta($post_id, '_lfc_phone', $phone);
    update_post_meta($post_id, '_lfc_service', $service);
    update_post_meta($post_id, '_lfc_budget', $budget);
    update_post_meta($post_id, '_lfc_message', $message);

    // Sync to Node.js REST API
    $api_url    = get_option('lfc_api_url', 'http://localhost:5000/api/leads');
    $api_secret = get_option('lfc_api_secret', 'my_jwt_or_secret_token');

    $payload = [
        'name'        => $name,
        'email'       => $email,
        'phone'       => $phone,
        'service'     => $service,
        'budgetRange' => $budget,
        'message'     => $message,
    ];

    $response = wp_remote_post($api_url, [
        'headers' => [
            'Content-Type'  => 'application/json',
            'Authorization' => 'Bearer ' . $api_secret,
        ],
        'body'    => json_encode($payload),
        'timeout' => 10,
    ]);

    if (is_wp_error($response)) {
        $error_msg = $response->get_error_message();
        update_post_meta($post_id, '_lfc_sync_status', 'Failed');
        update_post_meta($post_id, '_lfc_sync_error', $error_msg);
        return '<p style="color:orange;">Lead saved locally, but API sync failed: ' . esc_html($error_msg) . '</p>';
    }

    $code = wp_remote_retrieve_response_code($response);
    if ($code >= 200 && $code < 300) {
        update_post_meta($post_id, '_lfc_sync_status', 'Succeeded');
        return '<p style="color:green;">Lead submitted and synced successfully!</p>';
    } else {
        update_post_meta($post_id, '_lfc_sync_status', 'Failed');
        update_post_meta($post_id, '_lfc_sync_error', 'HTTP Code ' . $code);
        return '<p style="color:orange;">Lead saved locally, but API responded with HTTP ' . $code . '</p>';
    }
}