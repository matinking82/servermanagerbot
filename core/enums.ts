export enum UserState {
    start = "start",
    // Bash session
    bash_active = "bash_active",
    // PM2
    pm2_menu = "pm2_menu",
    // Tmux
    tmux_menu = "tmux_menu",
    // Docker
    docker_menu = "docker_menu",
    // Nginx
    nginx_menu = "nginx_menu",
    nginx_add_select_type = "nginx_add_select_type",
    nginx_add_port_to_url_port = "nginx_add_port_to_url_port",
    nginx_add_port_to_url_url = "nginx_add_port_to_url_url",
    nginx_add_port_to_folder_port = "nginx_add_port_to_folder_port",
    nginx_add_port_to_folder_path = "nginx_add_port_to_folder_path",
    nginx_add_domain_to_url_domain = "nginx_add_domain_to_url_domain",
    nginx_add_domain_to_url_url = "nginx_add_domain_to_url_url",
    nginx_add_domain_to_folder_domain = "nginx_add_domain_to_folder_domain",
    nginx_add_domain_to_folder_path = "nginx_add_domain_to_folder_path",
    // MySQL
    mysql_menu = "mysql_menu",
    mysql_create_db = "mysql_create_db",
    mysql_db_selected = "mysql_db_selected",
    mysql_run_query = "mysql_run_query",
    // File Explorer
    file_explorer = "file_explorer",
    file_explorer_create_folder = "file_explorer_create_folder",
    file_explorer_create_file = "file_explorer_create_file",
    file_explorer_create_file_content = "file_explorer_create_file_content",
    // Git
    git_menu = "git_menu",
    git_commit_msg = "git_commit_msg",
    git_branch_name = "git_branch_name",
    git_remote_name = "git_remote_name",
    git_remote_url = "git_remote_url",
}