<?php
/**
 * Plugin Name: Aijeong Performance Optimizer
 * Description: 불필요한 JS/CSS 제거, 메타 설명 추가, 스크립트 지연 로딩
 * Version: 1.0.0
 */

if (!defined('ABSPATH')) exit;

/**
 * 1. 프론트엔드에서 불필요한 JS 제거
 *    - jQuery / jQuery Migrate (블로그 글에 불필요)
 *    - 테마 메인 번들 (React/Vite 번들, 정적 블로그에 불필요)
 *    - WordPress emoji 스크립트
 */
add_action('wp_enqueue_scripts', function () {
    // 싱글 포스트 페이지에서 불필요한 스크립트 제거
    if (is_single()) {
        // jQuery 및 jQuery Migrate 제거
        wp_dequeue_script('jquery');
        wp_deregister_script('jquery');
        wp_dequeue_script('jquery-migrate');
        wp_deregister_script('jquery-migrate');

        // 테마 메인 JS 번들 제거 (handle은 테마에 따라 다를 수 있음)
        // 등록된 모든 스크립트에서 테마 번들 찾아서 제거
        global $wp_scripts;
        if (isset($wp_scripts->registered)) {
            foreach ($wp_scripts->registered as $handle => $script) {
                if (!empty($script->src) && strpos($script->src, '/themes/aijeong/dist/assets/main-') !== false) {
                    wp_dequeue_script($handle);
                    wp_deregister_script($handle);
                }
            }
        }
    }
}, 999);

/**
 * 2. WordPress emoji 스크립트/스타일 완전 제거
 */
remove_action('wp_head', 'print_emoji_detection_script', 7);
remove_action('wp_print_styles', 'print_emoji_styles');
remove_action('admin_print_scripts', 'print_emoji_detection_script');
remove_action('admin_print_styles', 'print_emoji_styles');
add_filter('emoji_svg_url', '__return_false');

/**
 * 3. 남은 스크립트에 defer 속성 추가
 */
add_filter('script_loader_tag', function ($tag, $handle, $src) {
    // 인라인 스크립트나 이미 defer/async 있는 것은 스킵
    if (strpos($tag, 'defer') !== false || strpos($tag, 'async') !== false) {
        return $tag;
    }
    // jQuery 관련은 스킵 (다른 페이지에서 필요할 수 있으므로)
    if (in_array($handle, ['jquery-core', 'jquery-migrate', 'jquery'])) {
        return $tag;
    }
    // wp-includes 내부 인라인 스크립트 스킵
    if (strpos($tag, 'src=') === false) {
        return $tag;
    }
    return str_replace(' src=', ' defer src=', $tag);
}, 10, 3);

/**
 * 4. 불필요한 CSS 제거 (싱글 포스트)
 */
add_action('wp_enqueue_scripts', function () {
    if (is_single()) {
        // WordPress 블록 에디터 CSS 제거 (클래식 에디터 사용 시)
        wp_dequeue_style('wp-block-library');
        wp_dequeue_style('wp-block-library-theme');
        wp_dequeue_style('global-styles');
        wp_dequeue_style('classic-theme-styles');
    }
}, 999);

/**
 * 5. 메타 설명 추가 (Yoast SEO 없을 때)
 */
add_action('wp_head', function () {
    if (is_single() || is_page()) {
        global $post;
        if (!$post) return;

        $description = $post->post_excerpt;
        if (empty($description)) {
            $description = wp_trim_words(strip_tags($post->post_content), 30, '...');
        }
        $description = esc_attr(trim($description));

        if (!empty($description)) {
            echo '<meta name="description" content="' . $description . '">' . "\n";
        }
    } elseif (is_front_page() || is_home()) {
        echo '<meta name="description" content="에이정, 가장 쉬운 AI교육. AI 교육 전문 기업 에이정에서 실무 중심 교육을 만나보세요.">' . "\n";
    }
}, 1);

/**
 * 6. Pretendard 폰트 preload 추가
 */
add_action('wp_head', function () {
    // 테마에서 사용하는 폰트 파일 preload
    $theme_uri = get_template_directory_uri();
    // Variable font 사용 시
    echo '<link rel="preload" href="' . $theme_uri . '/dist/assets/fonts/PretendardVariable.woff2" as="font" type="font/woff2" crossorigin>' . "\n";
}, 1);

/**
 * 7. DNS Prefetch / Preconnect 추가
 */
add_action('wp_head', function () {
    echo '<link rel="preconnect" href="https://cdn.channel.io" crossorigin>' . "\n";
    echo '<link rel="dns-prefetch" href="//cdn.channel.io">' . "\n";
    echo '<link rel="preconnect" href="https://www.googletagmanager.com" crossorigin>' . "\n";
    echo '<link rel="dns-prefetch" href="//www.googletagmanager.com">' . "\n";
}, 1);

/**
 * 8. WordPress 불필요한 헤더 제거
 */
remove_action('wp_head', 'wp_generator');
remove_action('wp_head', 'wlwmanifest_link');
remove_action('wp_head', 'rsd_link');
remove_action('wp_head', 'wp_shortlink_wp_head');
remove_action('wp_head', 'rest_output_link_wp_head');
remove_action('wp_head', 'wp_oembed_add_discovery_links');

/**
 * 9. FAQ 스키마 메타 필드 등록 및 출력
 */
add_action('init', function () {
    register_post_meta('post', '_faq_schema_json', [
        'show_in_rest' => true,
        'single' => true,
        'type' => 'string',
        'auth_callback' => function () {
            return current_user_can('edit_posts');
        },
    ]);
    register_post_meta('post', '_notion_page_id', [
        'show_in_rest' => true,
        'single' => true,
        'type' => 'string',
        'auth_callback' => function () {
            return current_user_can('edit_posts');
        },
    ]);
});

/**
 * 9-1. REST API에서 notion_page_id로 포스트 조회 허용
 */
add_filter('rest_post_query', function ($args, $request) {
    $notion_page_id = $request->get_param('notion_page_id');
    if ($notion_page_id) {
        $args['meta_query'] = [
            [
                'key' => '_notion_page_id',
                'value' => sanitize_text_field($notion_page_id),
            ],
        ];
    }
    return $args;
}, 10, 2);

add_action('wp_head', function () {
    if (!is_single()) return;
    global $post;
    if (!$post) return;

    $faq = get_post_meta($post->ID, '_faq_schema_json', true);
    if (!empty($faq)) {
        echo '<script type="application/ld+json">' . $faq . '</script>' . "\n";
    }
}, 2);

/**
 * 10. Canonical URL 추가 (WP 기본 canonical 제거 후 직접 출력)
 */
remove_action('wp_head', 'rel_canonical');
add_action('wp_head', function () {
    if (is_single() || is_page()) {
        echo '<link rel="canonical" href="' . esc_url(get_permalink()) . '">' . "\n";
    } elseif (is_front_page() || is_home()) {
        echo '<link rel="canonical" href="' . esc_url(home_url('/')) . '">' . "\n";
    }
}, 1);

/**
 * 11. Open Graph + Twitter Card 태그
 */
add_action('wp_head', function () {
    echo '<meta property="og:site_name" content="' . esc_attr(get_bloginfo('name')) . '">' . "\n";
    echo '<meta property="og:locale" content="ko_KR">' . "\n";

    if (is_single() || is_page()) {
        global $post;
        if (!$post) return;

        $title = esc_attr(get_the_title($post));
        $url = esc_url(get_permalink($post));
        $description = $post->post_excerpt;
        if (empty($description)) {
            $description = wp_trim_words(strip_tags($post->post_content), 30, '...');
        }
        $description = esc_attr(trim($description));

        echo '<meta property="og:type" content="article">' . "\n";
        echo '<meta property="og:title" content="' . $title . '">' . "\n";
        echo '<meta property="og:description" content="' . $description . '">' . "\n";
        echo '<meta property="og:url" content="' . $url . '">' . "\n";

        $thumb = get_the_post_thumbnail_url($post, 'full');
        if ($thumb) {
            echo '<meta property="og:image" content="' . esc_url($thumb) . '">' . "\n";
        }

        echo '<meta name="twitter:card" content="summary_large_image">' . "\n";
        echo '<meta name="twitter:title" content="' . $title . '">' . "\n";
        echo '<meta name="twitter:description" content="' . $description . '">' . "\n";
        if ($thumb) {
            echo '<meta name="twitter:image" content="' . esc_url($thumb) . '">' . "\n";
        }
    } elseif (is_front_page() || is_home()) {
        echo '<meta property="og:type" content="website">' . "\n";
        echo '<meta property="og:title" content="' . esc_attr(get_bloginfo('name')) . '">' . "\n";
        echo '<meta property="og:description" content="에이정, 가장 쉬운 AI교육. AI 교육 전문 기업 에이정에서 실무 중심 교육을 만나보세요.">' . "\n";
        echo '<meta property="og:url" content="' . esc_url(home_url('/')) . '">' . "\n";
    }
}, 1);

/**
 * 12. lang="ko" 설정
 */
add_filter('language_attributes', function ($output) {
    if (strpos($output, 'lang=') === false) {
        $output .= ' lang="ko"';
    }
    return $output;
});

/**
 * 13. RSS 피드 링크
 */
add_action('wp_head', function () {
    echo '<link rel="alternate" type="application/rss+xml" title="' . esc_attr(get_bloginfo('name')) . ' RSS Feed" href="' . esc_url(get_bloginfo('rss2_url')) . '">' . "\n";
}, 1);
