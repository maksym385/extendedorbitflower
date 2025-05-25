require 'sinatra'
require 'nokogiri'
require 'uri'
require 'set'

set :public_folder, File.dirname(__FILE__)

configure do
  enable :cross_origin
end

INPUT_FILE = 'server/organization.xml'
NAMESPACE = { "org" => "http://cpee.org/ns/organisation/1.0" }

get '/' do
  xml_path = File.join('server', 'organization.xml')
  if File.exist?(xml_path)
    output_html = `ruby orbitflower.rb #{xml_path}`
    content_type :html
    output_html
  else
    status 404
    "organization.xml not found in server directory"
  end
end

get '/update_svg' do
  if File.exist?(INPUT_FILE)
    update_svg = `ruby updatesvg.rb #{INPUT_FILE}`
    content_type 'image/svg+xml'
    update_svg
  else
    status 400
    "No XML file available for updating SVG"
  end
end

get '/update_userlist' do
  if File.exist?(INPUT_FILE)
    update_userlist = `ruby updateuserlist.rb #{INPUT_FILE}`
    content_type 'html'
    update_userlist
  else
    status 400
    "No XML file available for updating"
  end
end

#EDITING

post '/edit/subject' do
  subject_uid = params[:subject_uid]
  subject_name = params[:subject_name].strip
  unit_roles = JSON.parse(params[:unit_roles])
  
  xml = File.read(INPUT_FILE)
  doc = Nokogiri::XML(xml) { |config| config.default_xml.noblanks }

  subjects_node = doc.at_xpath("//org:subjects", NAMESPACE)

  if subject_uid == 'default'
    new_uid = SecureRandom.alphanumeric(8)
    new_subject = Nokogiri::XML::Node.new("subject", doc)
    new_subject['id'] = subject_name
    new_subject['uid'] = new_uid

    unit_roles.each do |unit_role|
      unit = unit_role["unit"]
      unit_role["roles"].each do |role|
        relation = Nokogiri::XML::Node.new("relation", doc)
        relation['unit'] = unit
        relation['role'] = role
        new_subject << relation
      end
    end
    subjects_node << new_subject
  else
    existing_subject = doc.at_xpath("//org:subject[@uid='#{subject_uid}']", NAMESPACE)
    halt 404, "Subject with UID #{subject_uid} not found!" unless existing_subject

    existing_subject['id'] = subject_name

    existing_subject.xpath(".//org:relation", NAMESPACE).remove
    unit_roles.each do |unit_role|
      unit = unit_role["unit"]
      unit_role["roles"].each do |role|
        relation = Nokogiri::XML::Node.new("relation", doc)
        relation['unit'] = unit
        relation['role'] = role
        existing_subject << relation
      end
    end
  end

  File.write(INPUT_FILE, doc.to_xml(indent: 2))
  status 200
end

post '/edit/:entity_type' do |entity_type|
  halt 404, "Invalid type" unless ['unit', 'role'].include?(entity_type)
  
  old_name = params[:old_name]
  new_name = params[:new_name].strip
  xml = File.read(INPUT_FILE)
  doc = Nokogiri::XML(xml)
 
  entity = doc.at_xpath("//org:#{entity_type}[@id='#{old_name}']", NAMESPACE)
 
  if entity
    entity['id'] = new_name

    doc.xpath("//org:relation[@#{entity_type}='#{old_name}']", NAMESPACE).each do |relation|
      relation[entity_type] = new_name
    end
 
    doc.xpath("//org:parent[text()='#{old_name}']", NAMESPACE).each do |parent|
      parent.content = new_name
    end
 
    File.write(INPUT_FILE, doc.to_xml)
    status 200
    "#{entity_type.capitalize} name updated successfully!"
  else
    status 404
    "#{entity_type.capitalize} '#{old_name}' not found."
  end
 end



#DELETING
post '/delete/subject' do
  subject_uid = params[:subject_uid]

  xml = File.read(INPUT_FILE)
  doc = Nokogiri::XML(xml)
  subject = doc.at_xpath("//org:subject[@uid='#{subject_uid}']", NAMESPACE)
  halt 404, "Subject with UID #{subject_uid} not found!" unless subject
  subject.remove
  
  doc.xpath('//text()[normalize-space(.) = ""]').each(&:remove)
  File.write(INPUT_FILE, doc.to_xml(indent: 2))
  
  status 200
  "Subject deleted successfully"
end

post '/delete/:entity_type' do |entity_type|
  halt 404, "Invalid type" unless ['unit', 'role'].include?(entity_type)
 
  entity_name = params["#{entity_type}_name"]
  xml = File.read(INPUT_FILE)
  doc = Nokogiri::XML(xml)
 
  entity = doc.at_xpath("//org:#{entity_type}[@id='#{entity_name}']", NAMESPACE)
 
  if entity
    doc.xpath("//org:relation[@#{entity_type}='#{entity_name}']", NAMESPACE).each do |relation|
      relation.remove
    end

    doc.xpath("//org:parent[text()='#{entity_name}']", NAMESPACE).each do |parent|
      parent.remove
    end
 
    entity.remove

    doc.xpath('//text()[normalize-space(.) = ""]').each(&:remove)
 
    File.write(INPUT_FILE, doc.to_xml)
    status 200
    "#{entity_type.capitalize} '#{entity_name}' deleted successfully!"
  else
    status 404
    "#{entity_type.capitalize} '#{entity_name}' not found."
  end
end


#ADDING

post '/add/:entity_type' do |entity_type|
  halt 404, "Invalid type" unless ['unit', 'role'].include?(entity_type)

  entity_name = params[:entity_name]

  if entity_name.nil? || entity_name.strip.empty?
    status 400
    return "#{entity_type} name is required."
  end

  unless ['role', 'unit', 'subject'].include?(entity_type)
    status 400
    return "Invalid entity type. Supported types are: role, unit and subject"
  end

  xml = File.read(INPUT_FILE)
  doc = Nokogiri::XML(xml) { |config| config.default_xml.noblanks }

  xpath_query = "//org:#{entity_type}[@id='#{entity_name}']"
  
  existing_entity = doc.at_xpath(xpath_query, NAMESPACE)
  if existing_entity
    status 409
    return "#{entity_type} '#{entity_name}' already exists."
  end

  new_entity = Nokogiri::XML::Node.new(entity_type, doc)
  new_entity['id'] = entity_name

  permissions = Nokogiri::XML::Node.new('permissions', doc)
  new_entity << permissions
  
  entities_container = doc.at_xpath("//org:#{entity_type}s", NAMESPACE)
  
  if entities_container
    entities_container << new_entity
  else
    entities_elem = Nokogiri::XML::Node.new("#{entity_type}s", doc)
    entities_elem << new_entity
    doc.root << entities_elem
  end

  File.write(INPUT_FILE, doc.to_xml(indent: 2))

  status 201
  "#{entity_type} '#{entity_name}' added successfully!"
end

#GETTING
get '/get/units' do
  xml = File.read(INPUT_FILE)
  doc = Nokogiri::XML(xml)
  units = doc.xpath('//org:unit', NAMESPACE).map { |unit| unit['id'] }

  units.to_json
end

get '/get/roles' do
  xml = File.read(INPUT_FILE)
  doc = Nokogiri::XML(xml)
  roles = doc.xpath('//org:role', NAMESPACE).map { |role| role['id'] }

  roles.to_json
end

get '/get/subjects' do
  status 404
  "Endpoint not implemented"
end

post '/get/relations' do
  subject_uid = params[:subject_uid]

  xml = File.read(INPUT_FILE)
  doc = Nokogiri::XML(xml)

  subject = doc.at_xpath("//org:subject[@uid='#{subject_uid}']", NAMESPACE)

  if subject
    subject_name = subject['id']

    unit_role_map = {}
    subject.xpath('org:relation', NAMESPACE).each do |relation|
      unit = relation['unit']
      role = relation['role']

      unit_role_map[unit] ||= []
      unit_role_map[unit] << role
    end
    content_type :json
    {
      name: subject_name,
      relations: unit_role_map
    }.to_json
  else
    status 404
    { error: "Subject not found" }.to_json
  end
end



#HELPERS
get '/helpers/*' do
  file_path = File.join(settings.public_folder, 'helpers', params['splat'].first)
  if File.exist?(file_path)
    send_file file_path
  else
    status 404
    "File not found"
  end
end

#Query Evaluation and computing of subjectlist

helpers do 
  
  def validate_syntax(tokens)
    paren_count = 0
    prev_token_type = nil
    prev_token_value = nil
    
    tokens.each do |token_type, value|
      case token_type
      when 'op'
        case value
        when '('
          paren_count += 1
        when ')'
          paren_count -= 1
          return false if paren_count < 0
        when 'AND', 'OR', '\\' 
          return false if prev_token_type == 'op' && prev_token_value != ')'
        when '¬'
          return false if prev_token_type && !['op'].include?(prev_token_type)
        end
      else
        return false if prev_token_type && prev_token_type != 'op'
        return false if prev_token_value == '¬' && token_type == 'op'
      end
      
      prev_token_type = token_type
      prev_token_value = value
    end
    
    paren_count == 0
  end

  def infix_to_postfix(tokens)
    output = []
    operator_stack = []
    
    precedence = {
      '¬' => 3,
      '\\' => 2,
      'AND' => 1,
      'OR' => 1
    }
    
    i = 0
    while i < tokens.length
      token_type, value = tokens[i]
      
      if i + 2 < tokens.length &&
        ((tokens[i][0] == 'unit' && tokens[i+1] == ['op', 'AND'] && tokens[i+2][0] == 'role') ||
          (tokens[i][0] == 'role' && tokens[i+1] == ['op', 'AND'] && tokens[i+2][0] == 'unit'))
        
        unit_val = tokens[i][0] == 'unit' ? tokens[i][1] : tokens[i+2][1]
        role_val = tokens[i][0] == 'role' ? tokens[i][1] : tokens[i+2][1]
        output.push(['relation', "#{unit_val}:#{role_val}"])
        i += 3
        next
      end

      if token_type == 'op'
        case value
        when '('
          operator_stack.push(value)
        when ')'
          while !operator_stack.empty? && operator_stack.last != '('
            output.push(['op', operator_stack.pop])
          end
          operator_stack.pop
        else
          while !operator_stack.empty? && 
                operator_stack.last != '(' && 
                precedence[operator_stack.last].to_i >= precedence[value].to_i
            output.push(['op', operator_stack.pop])
          end
          operator_stack.push(value)
        end
      else
        output.push([token_type, value])
      end
      i += 1
    end
    
    while !operator_stack.empty?
      op = operator_stack.pop
      output.push(['op', op]) unless op == '('
    end
    
    output
  end

  def evaluate_postfix(postfix_tokens)
    stack = []
    postfix_tokens.each do |token_type, value|
      puts "evaluating #{token_type}, #{value}"
      if token_type == 'op'
        case value
        when '¬'
          operand = stack.pop
          result = get_all_subjects - operand
          stack.push(result)
        when 'AND'
          right = stack.pop
          left = stack.pop
          result = left & right
          stack.push(result)
        when 'OR'
          right = stack.pop
          left = stack.pop
          result = left | right
          stack.push(result)
        when '\\'
          right = stack.pop
          left = stack.pop
          result = left - right
          stack.push(result)
        end
      else
        subjects = get_subjects_for_token(token_type, value)
        stack.push(subjects)
      end
    end
    stack.pop
  end


  def get_subjects_for_token(token_type, value)
    case token_type
    when 'relation'
      unit, role = value.split(':')
      get_subjects_by_relation(unit, role)
    when 'role'
      get_subjects_by_role(value)
    when 'unit'
      get_subjects_by_unit(value)
    when 'const'
      get_all_subjects
    else
      if subject_exists?(token_type)
        Set.new([[token_type, value]])
      else
        Set.new
      end
    end
  end

  #Evaluation helpers
  def get_subjects_by_role(role)
    xml = File.read(INPUT_FILE)
    doc = Nokogiri::XML(xml)

    matching_subjects = Set.new

    doc.xpath('//org:subject', NAMESPACE).each do |subject|
      has_matching_relation = subject.xpath('org:relation', NAMESPACE).any? do |relation|
        relation['role'] == role
      end

      if has_matching_relation
        subject_uid = subject['uid']
        subject_name = subject['id']
        matching_subjects << [subject_uid, subject_name]
      end
    end

    matching_subjects
  end

  def subject_exists?(uid)
    xml = File.read(INPUT_FILE)
    doc = Nokogiri::XML(xml)
  
    subject = doc.at_xpath("//org:subject[@uid='#{uid}']", NAMESPACE)
    !subject.nil?
  end

  def get_subjects_by_unit(unit)
    xml = File.read(INPUT_FILE)
    doc = Nokogiri::XML(xml)

    matching_subjects = Set.new

    doc.xpath('//org:subject', NAMESPACE).each do |subject|
      has_matching_relation = subject.xpath('org:relation', NAMESPACE).any? do |relation|
        relation['unit'] == unit
      end

      if has_matching_relation
        subject_uid = subject['uid']
        subject_name = subject['id']
        matching_subjects << [subject_uid, subject_name]
      end
    end

    matching_subjects
  end

  def get_subjects_by_relation(unit, role)
    xml = File.read(INPUT_FILE)
    doc = Nokogiri::XML(xml)

    matching_subjects = Set.new

    doc.xpath('//org:subject', NAMESPACE).each do |subject|
      has_matching_relation = subject.xpath('org:relation', NAMESPACE).any? do |relation|
        relation['unit'] == unit && relation['role'] == role
      end

      if has_matching_relation
        subject_uid = subject['uid']
        subject_name = subject['id']
        matching_subjects << [subject_uid, subject_name]
      end
    end

    matching_subjects
  end

  def get_all_subjects()
    xml = File.read(INPUT_FILE)
    doc = Nokogiri::XML(xml)

    matching_subjects = Set.new

    doc.xpath('//org:subject', NAMESPACE).each do |subject|
      subject_uid = subject['uid']
      subject_name = subject['id']
      matching_subjects << [subject_uid, subject_name]
    end

    matching_subjects
  end
end

get '/evaluate' do
  content_type :xml
  
  begin
    url = "http://localhost:4567#{request.fullpath}"
    uri = URI.parse(url)
    query_string = uri.query
    tokens = URI.decode_www_form(query_string)

    puts "Query Tokens: #{tokens}"
    isValid = validate_syntax(tokens)
    puts "Eval result: #{isValid}"
    if isValid
      postfix = infix_to_postfix(tokens)
      result_set = evaluate_postfix(postfix)
      builder = Nokogiri::XML::Builder.new do |xml|
        xml.subjects {
          result_set.each do |uid, name|
            xml.subject(id: name, uid: uid)
          end
        }
        
      end
      builder.to_xml
    else
      status 400
      Nokogiri::XML::Builder.new do |xml|
        xml.error {
          xml.message "Invalid Query Syntax"
        }
      end.to_xml
    end
  
  rescue StandardError => e
    status 400
    Nokogiri::XML::Builder.new do |xml|
      xml.error {
        xml.message e.message
      }
    end.to_xml
  end
end

get '/query' do
  xml_path = File.join('server', 'organization.xml')
  
  if File.exist?(xml_path)
    url = request.url
    uri = URI.parse(url)
    query_string = uri.query || ''
    
    output_html = `ruby orbitflower.rb #{xml_path}`
    modified_html = output_html.sub(
      /<\/body>/,
      %{
        <script>
          document.addEventListener('DOMContentLoaded', () => {
            queryBuilder = new QueryBuilder('#{query_string}');
            queryBuilder.initialize();
          });
        </script>
        </body>
      }
    )
    
    content_type :html
    modified_html
  else
    status 404
    "organization.xml not found in server directory"
  end
end


get '/mock' do
  <<-HTML
    <!DOCTYPE html>
    <html>
    <head>
      <title>Actors Interface</title>
      <script>
        function handleButtonClick() {
          const inputField = document.querySelector('.input-field');
          const inputValue = inputField.value.trim();

          if (inputValue) {
            try {
              let serverurl = window.location.origin;
                const url = new URL(inputValue);
                if (url.pathname.startsWith('/evaluate')) {
                    const queryUrl = new URL(serverurl+'/query');
                    queryUrl.search = url.search;
                    
                    const newTab = window.open(queryUrl.href, '_blank');
                } else {
                    
                    const newTab = window.open(url.href, '_blank');

                }
            } catch (e) {
                alert('Please enter a valid URL.');
            }
        } else {
            const newTab = window.open('http://localhost:4567/', '_blank');
          }
    }

        function updateInputFromNewTab(newContent) {
          const inputField = document.querySelector('.input-field');
          inputField.value = newContent;
        }
      </script>
    </head>
    <body>
      <div class="container">
        <label>Actors</label>
        <div class="input-group">
          <button class="up-button" onclick="handleButtonClick()">↑</button>
          <input type="text" class="input-field" placeholder="Enter URL here">
        </div>
      </div>
    </body>
    </html>
  HTML
end



Sinatra::Application.run!
  